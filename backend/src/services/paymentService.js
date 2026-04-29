const crypto = require('crypto');

/**
 * PayHere (Sri Lanka) Payment Integration
 * 
 * PayHere requires a set of hidden fields to be sent via a POST request to their gateway.
 * For security, we generate a signature (hash) on the backend.
 */

const getPayHereHash = (orderId, amount, currency) => {
  const merchantId = process.env.PAYHERE_MERCHANT_ID || '1211149'; // Default to test ID if not set
  const merchantSecret = process.env.PAYHERE_SECRET || '4MjY0NDc2ODU3MzExMzk2NTMxMzUxMzU3MDU3MjAzMTM2MTUyNTY='; // Default to test secret
  
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

const generatePayHereData = (order, event) => {
  const merchantId = process.env.PAYHERE_MERCHANT_ID || '1211149';
  const currency = 'LKR';
  
  const hash = getPayHereHash(order.orderNumber, order.totalAmount, currency);
  
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
 * To be implemented if Stripe is preferred or as a secondary option.
 */
const createStripeSession = async (order, event) => {
  // Logic for stripe.checkout.sessions.create
  // requires 'stripe' package
  console.log('Stripe session creation would happen here');
  return null;
};

module.exports = {
  getPayHereHash,
  generatePayHereData,
  createStripeSession
};
