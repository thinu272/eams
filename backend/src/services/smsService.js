let twilioClient = null;

try {
  // Twilio is optional in local/dev; the app falls back to logging when it isn't configured.
  const twilio = require('twilio');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (err) {
  console.warn('SMS: Twilio SDK not available, falling back to console logging.');
}

const phoneRegex = /^\+947\d{8}$/;
const windowMs = parseInt(process.env.SMS_RATE_WINDOW_MS || '900000', 10);
const maxPerWindow = parseInt(process.env.SMS_RATE_LIMIT_PER_WINDOW || '5', 10);
const rateStore = new Map();

const normalizePhone = (phone) => (phone || '').replace(/\s+/g, '').trim();

const isValidSriLankanPhone = (phone) => phoneRegex.test(normalizePhone(phone));

const isRateLimited = (key) => {
  const now = Date.now();
  const history = (rateStore.get(key) || []).filter((ts) => now - ts < windowMs);
  history.push(now);
  rateStore.set(key, history);
  return history.length > maxPerWindow;
};

const sendSMS = async (to, message, { rateKey } = {}) => {
  const phone = normalizePhone(to);
  if (!phone || !message) {
    return { sent: false, skipped: true };
  }

  if (!isValidSriLankanPhone(phone)) {
    throw new Error('Invalid Sri Lankan phone number. Use +947XXXXXXXX.');
  }

  if (isRateLimited(rateKey || phone)) {
    throw new Error('SMS rate limit exceeded.');
  }

  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('[SMS - dev mode, not sent]');
    console.log('To:', phone);
    console.log('Message:', message);
    return { sent: false, devMode: true };
  }

  try {
    const result = await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
      body: message,
    });

    return { sent: true, messageSid: result.sid };
  } catch (error) {
    console.error('SMS send failed:', error);
    throw error;
  }
};

module.exports = { sendSMS, isValidSriLankanPhone, normalizePhone };
