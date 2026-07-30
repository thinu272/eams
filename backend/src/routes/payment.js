const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { getPayHereHash, createPaymentSession, getActiveGateways } = require('../services/paymentService');
const { notifyOrderConfirmation } = require('../services/notificationService');
const { emitDashboardEvent, emitBuyerEvent } = require('../utils/socket');

/**
 * GET /api/payment/config/:eventId
 * Returns the active gateways & payment methods for this event's checkout page.
 */
router.get('/config/:eventId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const gatewayInfo = await getActiveGateways();

    res.json({
      success: true,
      data: {
        paymentMethods: event.settings?.paymentMethods || ['card'],
        gateways: gatewayInfo.activeGateways,
        defaultGateway: gatewayInfo.defaultGateway,
        currency: gatewayInfo.currency,
      }
    });
  } catch (error) {
    console.error('Payment config error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/payment/create-session
 * Creates a payment session for the given order & gateway (stripe or payhere).
 */
router.post('/create-session', async (req, res) => {
  try {
    const { orderId, gateway } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const event = await Event.findById(order.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const chosenGateway = gateway || (await getActiveGateways()).defaultGateway;
    const sessionResult = await createPaymentSession(order, event, chosenGateway);

    // Store gateway on the order
    order.gatewayUsed = chosenGateway;
    if (chosenGateway === 'stripe' && sessionResult.sessionId) {
      order.stripeSessionId = sessionResult.sessionId;
    }
    await order.save();

    res.json({
      success: true,
      data: sessionResult,
    });
  } catch (error) {
    console.error('Create payment session error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/payment/stripe-webhook
 * Stripe sends webhook events here (checkout.session.completed, etc.).
 */
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const SystemConfig = require('../models/SystemConfig');

  try {
    const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
    const endpointSecret = config.payment?.gateways?.stripe?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = config.payment?.gateways?.stripe?.secretKey || process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return res.status(500).send('Stripe not configured');
    }

    const stripe = require('stripe')(stripeKey);
    let event;

    if (endpointSecret) {
      const sig = req.headers['stripe-signature'];
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // No webhook secret configured — accept the payload as-is (dev mode)
      event = JSON.parse(req.body.toString());
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const eventId = session.metadata?.eventId;

      if (!orderId) {
        console.error('Stripe webhook: missing orderId in metadata');
        return res.status(400).send('Missing orderId');
      }

      const order = await Order.findById(orderId);
      if (!order) {
        console.error('Stripe webhook: order not found', orderId);
        return res.status(404).send('Order not found');
      }

      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.status = 'CONFIRMED';
        order.paidAt = new Date();
        order.gatewayUsed = 'stripe';
        order.paymentDetails = {
          gateway: 'stripe',
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          amountTotal: session.amount_total,
          currency: session.currency,
        };
        await order.save();

        // Update event revenue
        if (eventId) {
          await Event.findByIdAndUpdate(eventId, {
            $inc: { revenue: order.totalAmount }
          });
        }

        const io = req.app.get('io');
        emitDashboardEvent(io, 'payment_approved', eventId, {
          orderId: order._id,
          amount: order.totalAmount,
          paymentMethod: 'card',
          gateway: 'stripe',
        });
        emitDashboardEvent(io, 'event_update', eventId, {
          type: 'PAYMENT_CONFIRMED',
          eventId,
          orderId: order._id,
          paymentMethod: 'card',
          gateway: 'stripe',
        });

        if (order.buyerId) {
          emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: 'CONFIRMED',
            paymentStatus: order.paymentStatus,
          });
        }

        // Send confirmation notification
        const eventDoc = await Event.findById(eventId);
        if (eventDoc) {
          await notifyOrderConfirmation({
            order,
            event: eventDoc,
            buyerPhone: order.buyerPhone,
            notificationChannel: order.notificationChannel || 'email',
          }).catch(err => console.error('Stripe post-payment notification error:', err));
        }

        console.log(`STRIPE PAYMENT SUCCESS: Order ${order.orderNumber}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * PayHere Notify (Webhook)
 * PayHere sends a POST request to this URL when a payment is processed.
 */
router.post('/notify', async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      custom_1: orderId,
      custom_2: eventId
    } = req.body;

    // 1. Verify the signature
    console.log('PAYHERE webhook payload:', req.body);
    const merchantSecret = process.env.PAYHERE_SECRET || '4MjY0NDc2ODU3MzExMzk2NTMxMzUxMzU3MDU3MjAzMTM2MTUyNTY=';
    const amountFormatted = parseFloat(payhere_amount).toFixed(2);
    const localMd5Sig = crypto
      .createHash('md5')
      .update(
        merchant_id +
        order_id +
        amountFormatted +
        payhere_currency +
        status_code +
        crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
      )
      .digest('hex')
      .toUpperCase();

    if (localMd5Sig !== md5sig) {
      console.error('INVALID PAYMENT SIGNATURE:', order_id);
      return res.status(400).send('Invalid signature');
    }

    // 2. Handle payment status
    // status_code: 2 (Success), 0 (Pending), -1 (Cancelled), -2 (Failed), -3 (Charged Back)
    const order = await Order.findById(orderId);
    if (!order) {
      console.error('ORDER NOT FOUND FOR PAYMENT:', orderId);
      return res.status(404).send('Order not found');
    }

    if (status_code === '2') {
      // SUCCESS
      if (order.paymentStatus !== 'success') {
        order.paymentStatus = 'success';
        order.status = 'CONFIRMED';
        order.paidAt = new Date();
        order.gatewayUsed = 'payhere';
        order.paymentDetails = { 
          gateway: 'payhere',
          transactionId: req.body.payment_id,
          method: req.body.method,
          rawResponse: req.body
        };
        await order.save();

        // Update Event Revenue
        await Event.findByIdAndUpdate(eventId, {
          $inc: { revenue: order.totalAmount }
        });

        const io = req.app.get('io');
        emitDashboardEvent(io, 'payment_approved', eventId, {
          orderId: order._id,
          amount: order.totalAmount,
          paymentMethod: 'card',
          gateway: 'payhere',
        });
        emitDashboardEvent(io, 'event_update', eventId, {
          type: 'PAYMENT_CONFIRMED',
          eventId,
          orderId: order._id,
          paymentMethod: 'card',
          gateway: 'payhere',
        });

        if (order.buyerId) {
          emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: 'CONFIRMED',
            paymentStatus: order.paymentStatus,
          });
        }

        const event = await Event.findById(eventId);
        if (event) {
          await notifyOrderConfirmation({
            order,
            event,
            buyerPhone: order.buyerPhone,
            notificationChannel: order.notificationChannel || 'email',
          }).catch((error) => {
            console.error('POST-PAYMENT BUYER EMAIL ERROR:', error);
          });
        }

        console.log(`PAYMENT SUCCESS: Order ${order.orderNumber}, Amount ${payhere_amount}`);
      }
    } else if (status_code === '0') {
      order.paymentStatus = 'pending';
      await order.save();
    } else {
      // FAILED / CANCELLED
      if (order.paymentStatus !== 'failed' && order.paymentStatus !== 'cancelled') {
        // Release tickets back to inventory
        for (const item of order.tickets) {
          const event = await Event.findById(eventId);
          const category = (event?.categories || []).find(c => c.name === item.categoryName);
          const decData = { 'categories.$.sold': -item.quantity };
          if (category?.isPrivate) {
            decData['categories.$.usageCount'] = -item.quantity;
          }

          await Event.updateOne(
            { _id: eventId, 'categories.name': item.categoryName },
            { $inc: decData }
          );
        }

        // Broadcast availability update
        const { emitDashboardEvent } = require('../utils/socket');
        const io = req.app.get('io');
        emitDashboardEvent(io, 'event_update', eventId, {
          type: 'TICKET_RELEASED',
          eventId,
          tickets: order.tickets
        });
      }

      order.paymentStatus = 'failed';
      order.status = 'CANCELLED';
      order.paymentDetails = { 
        gateway: 'payhere',
        errorCode: status_code,
        rawResponse: req.body
      };
      await order.save();
      
      console.log(`PAYMENT FAILED/CANCELLED: Order ${order.orderNumber}, Status ${status_code}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('PAYMENT NOTIFY ERROR:', error);
    res.status(500).send('Internal Server Error');
  }
});


// ──────────────────────────────────────────────
// Cash at Entrance routes
// ──────────────────────────────────────────────
const cashEntranceController = require('../controllers/cashEntranceController');
const { protect: authenticate } = require('../middleware/auth');

// Public: create a cash reservation
router.post('/cash-reservation', cashEntranceController.createCashReservation);

// Public: get cash payment instructions for an order
router.get('/cash-instructions/:orderId', cashEntranceController.getCashInstructions);

// Public: submit additional reservation info
router.post('/cash-reservation/:orderId/info', cashEntranceController.submitReservationInfo);

// Protected: staff confirms cash payment received at venue
router.post('/cash-confirm/:orderId', authenticate, cashEntranceController.confirmCashPayment);

// Protected: get cash orders for staff dashboard
router.get('/cash-orders', authenticate, cashEntranceController.getCashOrders);

module.exports = router;

