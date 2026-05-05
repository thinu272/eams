const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global',
  },
  general: {
    platformName: { type: String, default: 'ENTRYNEX' },
    supportEmail: { type: String, default: 'support@entrynex.com' },
    systemStatus: { type: String, enum: ['Active', 'Maintenance'], default: 'Active' },
    defaultRoles: { type: [String], default: ['Attendee'] },
  },
  branding: {
    logoUrl: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#2563eb' },
    secondaryColor: { type: String, default: '#4f46e5' },
    applyToEmails: { type: Boolean, default: true },
    applyToTickets: { type: Boolean, default: true },
    applyToUi: { type: Boolean, default: true },
  },
  email: {
    provider: { type: String, enum: ['smtp', 'sendgrid', 'mock'], default: 'smtp' },
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    smtpPassword: { type: String, default: '' },
    sendgridApiKey: { type: String, default: '' },
    senderName: { type: String, default: 'ENTRYNEX' },
    templates: {
      inviteSubject: { type: String, default: "You're Invited - {{eventName}}" },
      ticketSubject: { type: String, default: 'Confirmed - Your ticket for {{eventName}}' },
      resetSubject: { type: String, default: 'Password Reset Request' },
    },
  },
  sms: {
    provider: { type: String, enum: ['mock', 'twilio', 'localApi'], default: 'mock' },
    apiKey: { type: String, default: '' },
    apiSecret: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
  },
  payment: {
    gateway: { type: String, enum: ['none', 'stripe', 'payhere'], default: 'none' },
    publishableKey: { type: String, default: '' },
    secretKey: { type: String, default: '' },
    defaultCurrency: { type: String, default: 'LKR' },
    enabled: { type: Boolean, default: false },
  },
  security: {
    jwtTtlHours: { type: Number, default: 24 },
    minPasswordLength: { type: Number, default: 8 },
    requirePasswordComplexity: { type: Boolean, default: false },
    loginRateLimit: { type: Number, default: 5 },
    emailVerificationRequired: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
  },
  ticketing: {
    qrEnabled: { type: Boolean, default: true },
    pdfEnabled: { type: Boolean, default: true },
    autoSendOnConfirm: { type: Boolean, default: true },
    accessCodeToggle: { type: Boolean, default: true },
  },
  regional: {
    defaultCurrency: { type: String, default: 'LKR' },
    timezone: { type: String, default: 'Asia/Colombo' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
    multiCurrency: { type: Boolean, default: false },
  },
  integrations: {
    storageProvider: { type: String, enum: ['local', 'aws', 'cloudinary'], default: 'local' },
    awsAccessKey: { type: String, default: '' },
    awsSecretKey: { type: String, default: '' },
    awsBucket: { type: String, default: '' },
    mapsApiKey: { type: String, default: '' },
    aiServiceKey: { type: String, default: '' },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
