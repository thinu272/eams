const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },

  categoryId: { type: String, required: true },
  categoryName: { type: String, required: true },
  price: { type: Number, required: true },
  slotIndex: { type: Number, required: true }, // 1-based index within the order

  status: {
    type: String,
    enum: ['unassigned', 'invited', 'confirmed', 'cancelled'],
    default: 'unassigned',
  },

  // Invite tracking (when buyer delegates to someone else)
  inviteEmail: { type: String },
  inviteToken: { type: String },
  inviteSentAt: { type: Date },

  ticketNumber: { type: String, unique: true },
}, {
  timestamps: true,
});

ticketSchema.pre('save', function (next) {
  if (!this.ticketNumber) {
    this.ticketNumber = 'TKT-' + Date.now() + '-' + this.slotIndex;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
