const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    default: () => 'ORD-' + uuidv4().substring(0, 8).toUpperCase(),
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendee',
    required: true,
  },
  buyerEmail: { type: String, required: true },
  buyerName: { type: String, required: true },
  buyerPhone: { type: String },

  // Line items per category
  items: [{
    categoryId: { type: String, required: true },
    categoryName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  }],

  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'LKR' },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentMethod: { type: String },
  paymentReference: { type: String },
  paidAt: { type: Date },

  // Confirmation tracking
  confirmationStatus: {
    type: String,
    enum: ['pending', 'partial', 'complete'],
    default: 'pending',
  },
  confirmationLink: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  confirmationLinkExpires: { type: Date },

  // Email tracking
  confirmationEmailSent: { type: Boolean, default: false },
  finalEmailSent: { type: Boolean, default: false },

  notes: { type: String },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);
