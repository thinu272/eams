const mongoose = require('mongoose');

const zoneLogSchema = new mongoose.Schema({
  attendeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendee',
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  zoneName: {
    type: String,
    required: true,
    trim: true,
  },
  action: {
    type: String,
    enum: ['ENTRY', 'EXIT'],
    required: true,
  },
  accessGranted: {
    type: Boolean,
    default: true,
  },
  denialReason: {
    type: String,
    enum: ['NOT_ALLOWED', 'INVALID_TICKET', 'DUPLICATE_SCAN'],
  },
  scanMethod: {
    type: String,
    enum: ['QR', 'RFID'],
    default: 'QR',
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  attendeeSnapshot: {
    fullName: { type: String },
    categoryName: { type: String },
    allowedZones: [{ type: String }],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

zoneLogSchema.index({ eventId: 1, zoneName: 1, timestamp: -1 });
zoneLogSchema.index({ attendeeId: 1, zoneName: 1, timestamp: -1 });

module.exports = mongoose.model('ZoneLog', zoneLogSchema);
