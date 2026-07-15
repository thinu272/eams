const mongoose = require('mongoose');

const paymentSubmissionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  payerName: {
    type: String,
    required: true,
    trim: true,
  },
  payerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  payerPhone: {
    type: String,
    required: true,
    trim: true,
  },
  payerNicPassport: {
    type: String,
    trim: true,
  },
  bankUsed: {
    type: String,
    required: true,
    trim: true,
  },
  transferDate: {
    type: Date,
    required: true,
  },
  transferTime: {
    type: String,
    required: true,
  },
  referenceNumber: {
    type: String,
    required: true,
    trim: true,
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0,
  },
  receiptFile: {
    type: String, // URL to uploaded file
    required: true,
  },
  receiptFileType: {
    type: String,
    enum: ['image', 'pdf'],
  },
  notes: {
    type: String,
    trim: true,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs_info'],
    default: 'pending',
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verifiedAt: {
    type: Date,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient lookups
paymentSubmissionSchema.index({ orderId: 1, createdAt: -1 });
paymentSubmissionSchema.index({ verificationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentSubmission', paymentSubmissionSchema);
