const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attendeeSchema = new mongoose.Schema({
  // Identity
  fullName: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  dateOfBirth: { type: Date },
  nationalId: { type: String, trim: true },
  passportNumber: { type: String, trim: true },
  nationality: { type: String, trim: true },
  photo: { type: String }, // file path or URL
  customFieldValues: { type: Map, of: String },

  // Ticket linkage
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  categoryId: { type: String },
  categoryName: { type: String },
  allowedZones: [{ type: String }],

  // QR code
  qrCode: { type: String }, // base64 or file path
  qrToken: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },

  // Confirmation
  confirmationStatus: {
    type: String,
    enum: ['pending', 'invited', 'confirmed', 'rejected'],
    default: 'pending',
  },
  confirmationToken: { type: String, default: () => uuidv4() },
  confirmedAt: { type: Date },
  confirmedBy: {
    type: String,
    enum: ['self', 'organiser', 'sub_organiser'],
  },

  // Photo verification
  photoVerificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  photoVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  photoVerifiedAt: { type: Date },
  photoRejectionReason: { type: String },

  // Source of attendee record
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedVia: {
    type: String,
    enum: ['self_purchase', 'manual', 'bulk_upload', 'invite'],
    default: 'self_purchase',
  },

  // Wristband
  wristbandId: { type: String },
  wristbandIssuedAt: { type: Date },
  wristbandIssuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Email tracking
  inviteEmailSent: { type: Boolean, default: false },
  confirmationEmailSent: { type: Boolean, default: false },

  notes: { type: String },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

attendeeSchema.index({ event: 1, email: 1 });
attendeeSchema.index({ qrToken: 1 });
attendeeSchema.index({ confirmationToken: 1 });

module.exports = mongoose.model('Attendee', attendeeSchema);
