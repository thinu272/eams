const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const normalizeRoleForStorage = (role) => {
  const normalized = String(role || '').trim().toUpperCase();

  if (normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'MAIN_ADMIN') return 'main_admin';
  if (normalized === 'ORGANISER' || normalized === 'MAIN_ORGANISER') return 'main_organiser';
  if (normalized === 'SUB_ORGANISER') return 'sub_organiser';
  if (normalized === 'STAFF') return 'staff';
  if (normalized === 'VOLUNTEER') return 'volunteer';
  if (normalized === 'AUDITOR') return 'auditor';
  if (normalized === 'BUYER') return 'buyer';

  return String(role || '').trim().toLowerCase();
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
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
    enum: ['main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor', 'buyer'],
    required: true,
    set: normalizeRoleForStorage,
  },
  phone: { type: String, trim: true },
  profilePhoto: { type: String },
  isActive: { type: Boolean, default: true },

  // Event assignments (for non-admin roles)
  assignedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],

  // Permissions (for sub_organiser - set by main_organiser)
  permissions: {
    canAddAttendees: { type: Boolean, default: true },
    canBulkUpload: { type: Boolean, default: true },
    canVerifyPhotos: { type: Boolean, default: true },
    canInviteAttendees: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: false },
    canManageStaff: { type: Boolean, default: false },
  },

  // For staff/volunteer - which entry points / zones they manage
  assignedZones: [{ type: String }],
  assignedGates: [{ type: String }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLogin: { type: Date },

  // Password reset
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
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
