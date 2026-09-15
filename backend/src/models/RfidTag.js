const mongoose = require('mongoose');

const rfidTagSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  categoryId: { type: String },
  rfidTag: { type: String, required: true, trim: true },
  status: { type: String, enum: ['AVAILABLE', 'ASSIGNED', 'DISABLED'], default: 'AVAILABLE' },
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
}, { timestamps: true });

rfidTagSchema.index({ rfidTag: 1 }, { unique: true });
rfidTagSchema.index({ status: 1, event: 1, categoryId: 1 });

module.exports = mongoose.model('RfidTag', rfidTagSchema);