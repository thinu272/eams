const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Normalizes input roles to match the ENTRYNEX standard hierarchy.
 */
const normalizeRoleForStorage = (role) => {
  const normalized = String(role || '').trim().toUpperCase();

  if (normalized === 'MAINADMIN' || normalized === 'ADMIN' || normalized === 'MAIN_ADMIN') return 'MainAdmin';
  if (normalized === 'MAINORGANISER' || normalized === 'ORGANISER' || normalized === 'MAIN_ORGANISER') return 'MainOrganiser';
  if (normalized === 'SUBORGANISER' || normalized === 'SUB_ORGANISER') return 'SubOrganiser';
  if (normalized === 'STAFF') return 'Staff';
  if (normalized === 'VOLUNTEER') return 'Volunteer';
  if (normalized === 'AUDITOR') return 'Auditor';
  if (normalized === 'ATTENDEE' || normalized === 'USER' || normalized === 'BUYER') return 'Attendee';

  return String(role || '').trim();
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  role: {
    type: String,
    enum: ['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor', 'Attendee'],
    required: true,
    set: normalizeRoleForStorage,
  },
  phone: { 
    type: String, 
    required: [true, 'Phone number is required for SMS notifications'],
    trim: true 
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },

  // Scoped Event Assignments
  assignedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  assignedGates: [{ type: String }],
  assignedZones: [{ type: String }],

  // Granular Permissions (JSON Object as requested)
  permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  customRole: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
  },
  responsibilities: {
    zoneIds: [{ type: String }],
    verificationAccess: { type: Boolean, default: false },
    entryAccess: { type: Boolean, default: false },
  },

  profilePhoto: { type: String },
  profilePhotoS3Key: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLogin: { type: Date },

  // Password reset fields
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },

  // Email verification and security fields
  isVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  isTempPassword: { type: Boolean, default: false },
  // Security & MFA
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, select: false },
  mfaBackupCodes: [{ type: String, select: false }],
  lastMfaVerification: { type: Date },
  
  refreshToken: { type: String, select: false },
}, {
  timestamps: true,
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
