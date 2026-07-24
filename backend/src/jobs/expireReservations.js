const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const SystemConfig = require('../models/SystemConfig');
const { sendWithProvider, baseTemplate } = require('../utils/email');
const { sendSMS } = require('../services/smsService');

/**
 * Expire stale cash-at-entrance reservations.
 * Should be called periodically (e.g., every hour via setInterval or cron).
 */
async function expireReservations() {
  try {
    const config = await SystemConfig.findOne({ key: 'global' }).lean();
    const expiryHours = config?.payment?.cashAtEntrance?.reservationExpiryHours ?? 48;
    const cutoff = new Date(Date.now() - expiryHours * 60 * 60 * 1000);

    // Find reserved cash orders older than the cutoff
    const expiredOrders = await Order.find({
      status: 'RESERVED',
      paymentMethod: { $in: ['cash_at_entrance', 'cash_on_entrance'] },
      createdAt: { $lt: cutoff },
    }).populate('eventId');

    if (expiredOrders.length === 0) return;

    console.log(`[expireReservations] Found ${expiredOrders.length} expired reservation(s).`);

    for (const order of expiredOrders) {
      // Cancel the order
      order.status = 'EXPIRED';
      order.paymentStatus = 'expired';
      await order.save();

      // Cancel tickets and release inventory
      const tickets = await Ticket.find({ order: order._id });
      for (const ticket of tickets) {
        ticket.status = 'CANCELLED';
        await ticket.save();
      }

      // Release sold counts back to event categories
      if (order.eventId) {
        for (const item of order.tickets) {
          await Event.updateOne(
            { _id: order.eventId._id, 'categories.name': item.categoryName },
            { $inc: { 'categories.$.sold': -item.quantity } }
          );
        }
      }

      // Notify buyer
      try {
        const html = baseTemplate(`
          <h2>Reservation Expired</h2>
          <p>Dear ${order.buyerName},</p>
          <p>Your reservation for order <strong>#${order.orderNumber}</strong> has expired because payment was not collected at the venue within the allowed time.</p>
          <p>The reserved tickets have been released back to inventory. If you still wish to attend, please create a new booking.</p>
        `, 'Reservation Expired');

        await sendWithProvider({
          to: order.buyerEmail,
          subject: `Reservation Expired - #${order.orderNumber}`,
          html,
        });
      } catch (emailErr) {
        console.error(`[expireReservations] Email error for order ${order.orderNumber}:`, emailErr);
      }

      if (order.buyerPhone) {
        try {
          await sendSMS(
            order.buyerPhone,
            `ENTRYNEX: Your reservation #${order.orderNumber} has expired. Tickets released. Please create a new booking if needed.`,
            { rateKey: `expire:${order.buyerPhone}` }
          );
        } catch (smsErr) {
          console.error(`[expireReservations] SMS error for order ${order.orderNumber}:`, smsErr);
        }
      }

      console.log(`[expireReservations] Expired order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('[expireReservations] Fatal error:', error);
  }
}

// Start a repeating timer (every hour)
function startExpiryJob() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  console.log('[expireReservations] Job scheduled – runs every hour.');
  setInterval(expireReservations, INTERVAL_MS);
  // Run once immediately on startup
  expireReservations();
}

module.exports = { expireReservations, startExpiryJob };
