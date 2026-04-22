const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global',
  },
  theme: {
    defaultMode: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    accent: {
      type: String,
      default: '#2563eb',
    },
  },
  communication: {
    senderEmail: {
      type: String,
      default: process.env.EMAIL_FROM || 'noreply@eams.com',
    },
    smsSender: {
      type: String,
      default: process.env.TWILIO_PHONE_NUMBER || '',
    },
    emailProvider: {
      type: String,
      default: process.env.SENDGRID_API_KEY ? 'sendgrid' : 'smtp',
    },
    smsProvider: {
      type: String,
      default: process.env.TWILIO_ACCOUNT_SID ? 'twilio' : 'mock',
    },
  },
  templates: {
    invite: {
      subject: { type: String, default: "You're Invited - {{eventName}}" },
      sms: { type: String, default: "EAMS: You're invited to {{eventName}}. Confirm here: {{link}}" },
    },
    confirmation: {
      subject: { type: String, default: 'Confirmed - Your ticket for {{eventName}}' },
      sms: { type: String, default: 'EAMS: Ticket confirmed for {{eventName}}. Show QR at entry: {{link}}' },
    },
    rejection: {
      subject: { type: String, default: 'Photo Rejected - Resubmit for {{eventName}}' },
      sms: { type: String, default: 'EAMS: Your photo was rejected. Reason: {{reason}}. Re-upload here: {{link}}' },
    },
  },
  retention: {
    logsDays: { type: Number, default: 365 },
    notificationsDays: { type: Number, default: 90 },
  },
  security: {
    mode: {
      type: String,
      enum: ['strict', 'balanced', 'open'],
      default: 'strict',
    },
    jwtTtlHours: {
      type: Number,
      default: 24,
    },
    requirePhotoVerification: {
      type: Boolean,
      default: true,
    },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
