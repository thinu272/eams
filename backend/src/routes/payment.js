const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { getPayHereHash } = require('../services/paymentService');
const { notifyOrderConfirmation } = require('../services/notificationService');

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
    const merchantSecret = process.env.PAYHERE_SECRET || '4MjY0NDc2ODU3MzExMzk2NTMxMzUxMzU3MDU3MjAzMTM2MTUyNTY=';
    const localMd5Sig = crypto
      .createHash('md5')
      .update(
        merchant_id +
        order_id +
        payhere_amount +
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
          await Event.updateOne(
            { _id: eventId, 'categories.name': item.categoryName },
            { $inc: { 'categories.$.sold': -item.quantity } }
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

module.exports = router;
