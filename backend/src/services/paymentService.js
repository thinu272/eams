const crypto = require('crypto');
const SystemConfig = require('../models/SystemConfig');

/**
 * PayHere (Sri Lanka) Payment Integration
 */

const getPayHereHash = async (orderId, amount, currency) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const merchantId = config.payment?.publishableKey || process.env.PAYHERE_MERCHANT_ID || '1211149';
  const merchantSecret = config.payment?.secretKey || process.env.PAYHERE_SECRET || '4MjY0NDc2ODU3MzExMzk2NTMxMzUxMzU3MDU3MjAzMTM2MTUyNTY=';
  
  const amountFormatted = parseFloat(amount).toFixed(2);
  
  const hash = crypto
    .createHash('md5')
    .update(
      merchantId +
      orderId +
      amountFormatted +
      currency +
      crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
    )
    .digest('hex')
    .toUpperCase();
    
  return hash;
};

const generatePayHereData = async (order, event) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const merchantId = config.payment?.publishableKey || process.env.PAYHERE_MERCHANT_ID || '1211149';
  const currency = config.payment?.defaultCurrency || 'LKR';
  
  const hash = await getPayHereHash(order.orderNumber, order.totalAmount, currency);
  
  return {
    merchant_id: merchantId,
    return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${order.confirmationToken}/success`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${order.confirmationToken}/cancel`,
    notify_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/notify`,
    order_id: order.orderNumber,
    items: `${event.name} Tickets`,
    currency: currency,
    amount: order.totalAmount,
    first_name: order.buyerName.split(' ')[0],
    last_name: order.buyerName.split(' ').slice(1).join(' ') || 'Buyer',
    email: order.buyerEmail,
    phone: order.buyerPhone || '',
    address: 'ENTRYNEX Online',
    city: 'Colombo',
    country: 'Sri Lanka',
    hash: hash,
    // Add custom variables if needed
    custom_1: order._id.toString(),
    custom_2: event._id.toString()
  };
};

/**
 * Stripe Integration (Placeholder)
 */
const createStripeSession = async (order, event) => {
  console.log('Stripe session creation would happen here');
  return null;
};

module.exports = {
  getPayHereHash,
  generatePayHereData,
  createStripeSession
};
