const mongoose = require('mongoose');

const entryLogSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  attendee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendee',
    required: true,
  },

  // Where the scan happened
  gateId: { type: String, required: true },
  gateName: { type: String },
  zoneId: { type: String },
  zoneName: { type: String },

  // What happened
  action: {
    type: String,
    enum: ['check_in', 'check_out', 'zone_entry', 'zone_exit', 'denied'],
    required: true,
  },
  method: {
    type: String,
    enum: ['qr', 'rfid', 'manual'],
    default: 'qr',
  },

  // Result
  accessGranted: { type: Boolean, required: true },
  denialReason: { type: String },

  // Who processed it
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Snapshot of attendee at time of scan (for offline resilience)
  snapshot: {
    fullName: { type: String },
    categoryId: { type: String },
    categoryName: { type: String },
    allowedZones: [{ type: String }],
    photoVerified: { type: Boolean },
  },

  timestamp: { type: Date, default: Date.now },
}, {
  timestamps: false,
});

entryLogSchema.index({ event: 1, timestamp: -1 });
entryLogSchema.index({ attendee: 1, event: 1 });
entryLogSchema.index({ event: 1, gateId: 1, timestamp: -1 });

module.exports = mongoose.model('EntryLog', entryLogSchema);
