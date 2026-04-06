const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    default: function() {
      return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    },
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  buyerName: {
    type: String,
    required: true,
    trim: true,
  },
  buyerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  buyerPhone: {
    type: String,
    trim: true,
  },
  tickets: [{
    categoryName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    default: 'PENDING',
  },
  confirmationToken: {
    type: String,
    default: () => uuidv4(),
  },
  allAssigned: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient lookups
orderSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
