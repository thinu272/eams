/**
 * SMS Service Adapter Pattern
 * This service manages SMS providers and handles rate limiting.
 */

const { v4: uuidv4 } = require('uuid');
const SystemConfig = require('../models/SystemConfig');

// Provider Interface (Implicit) should implement:
// async send(to, message) -> { success: boolean, messageId?: string, error?: string }

class TwilioProvider {
  constructor(config) {
    this.client = null;
    this.from = config.general?.platformName || process.env.TWILIO_PHONE_NUMBER;
    
    const sid = config.sms?.apiKey || process.env.TWILIO_ACCOUNT_SID;
    const token = config.sms?.apiSecret || process.env.TWILIO_AUTH_TOKEN;
    
    if (sid && token) {
      this.client = require('twilio')(sid, token);
    }
  }

  async send(to, message) {
    if (!this.client || !this.from) {
      console.log(`[SMS MOCK] To: ${to} | Message: ${message}`);
      return { success: true, mock: true };
    }

    try {
      const result = await this.client.messages.create({
        from: this.from,
        to,
        body: message,
      });
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('Twilio Send Error:', error);
      return { success: false, error: error.message };
    }
  }
}

class SMSManager {
  constructor() {
    this.rateStore = new Map();
    this.windowMs = parseInt(process.env.SMS_RATE_WINDOW_MS || '900000', 10);
    this.maxPerWindow = parseInt(process.env.SMS_RATE_LIMIT_PER_WINDOW || '5', 10);
  }

  _isRateLimited(key) {
    const now = Date.now();
    const history = (this.rateStore.get(key) || []).filter((ts) => now - ts < this.windowMs);
    history.push(now);
    this.rateStore.set(key, history);
    return history.length > this.maxPerWindow;
  }

  async sendSMS(to, message, { rateKey } = {}) {
    if (!to || !message) return { sent: false, skipped: true };

    const phone = to.replace(/\s+/g, '').trim();
    
    if (this._isRateLimited(rateKey || phone)) {
      throw new Error('SMS rate limit exceeded.');
    }

    const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
    
    if (config.sms?.provider === 'mock') {
      console.log(`[SMS MOCK] To: ${phone} | Message: ${message}`);
      return { sent: true, mock: true };
    }

    const provider = new TwilioProvider(config);
    const res = await provider.send(phone, message);
    
    return {
      sent: res.success,
      messageId: res.messageId,
      mock: res.mock,
      error: res.error
    };
  }
}

const manager = new SMSManager();

module.exports = {
  sendSMS: (to, message, options) => manager.sendSMS(to, message, options),
};
