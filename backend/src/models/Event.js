const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  capacity: { type: Number, default: 0 },
  color: { type: String, default: '#3B82F6' },
}, { _id: false });

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  sold: { type: Number, default: 0 },
  color: { type: String, default: '#3B82F6' },
  allowedZones: [{ type: String }], // zone ids
  benefits: [{ type: String }],
  customFields: [{
    name: { type: String },
    type: { type: String, enum: ['text', 'number', 'date', 'select'], default: 'text' },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
  }],
}, { _id: false });

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true,
  },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String },
  eventType: {
    type: String,
    enum: ['cricket', 'concert', 'conference', 'other'],
    default: 'cricket',
  },
  venue: {
    name: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    mapUrl: { type: String },
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  gatesOpenTime: { type: Date },
  status: {
    type: String,
    enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
    default: 'draft',
  },
  coverImage: { type: String },
  bannerImage: { type: String },

  // Ticket categories (e.g., VIP, General, School, Media)
  categories: [categorySchema],

  // Physical zones inside the venue
  zones: [zoneSchema],

  // Team / match details for cricket
  matchDetails: {
    teamA: { type: String },
    teamB: { type: String },
    matchType: { type: String },
    series: { type: String },
  },

  // Assigned personnel
  mainOrganiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subOrganisers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  volunteers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  auditors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Settings
  settings: {
    requirePhotoVerification: { type: Boolean, default: true },
    allowSelfConfirmation: { type: Boolean, default: true },
    confirmationDeadlineHours: { type: Number, default: 48 },
    maxTicketsPerOrder: { type: Number, default: 10 },
    rfidEnabled: { type: Boolean, default: true },
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: { type: Date },
}, {
  timestamps: true,
});

// Auto-generate slug from name
eventSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);
