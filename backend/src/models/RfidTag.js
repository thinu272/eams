const mongoose = require('mongoose');

const rfidTagSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  categoryId: { type: String, required: true },
  rfidTag: { type: String, required: true, trim: true },
  sequence: { type: Number, required: true },
  status: { type: String, enum: ['available', 'assigned'], default: 'available' },
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  assignedAt: { type: Date },
}, { timestamps: true });

rfidTagSchema.index({ event: 1, rfidTag: 1 }, { unique: true });
rfidTagSchema.index({ event: 1, categoryId: 1, status: 1, sequence: 1 });

module.exports = mongoose.model('RfidTag', rfidTagSchema);