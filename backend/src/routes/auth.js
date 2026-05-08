const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const { protect } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per `window`
  message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signAccessToken = (id, ttlHours = 24) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: `${ttlHours}h` });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const sendTokens = async (user, statusCode, res) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const ttlHours = config.security?.jwtTtlHours || 24;
  
  const accessToken = signAccessToken(user._id, ttlHours);
  const refreshToken = signRefreshToken(user._id);
  
  user.refreshToken = refreshToken;
  // Reset login attempts on successful login
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  res.status(statusCode).json({
    success: true,
    accessToken, // We still send accessToken for frontend headers if needed, or rely on cookies
    data: { user },
  });
};

// POST /api/auth/login
router.post('/login', loginLimiter, [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { email, password, mfaToken } = req.body;
    const user = await User.findOne({ email }).select('+password +mfaSecret +loginAttempts +lockUntil');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(401).json({ 
        success: false, 
        message: `Account is locked. Please try again after 15 minutes.` 
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment failed attempts
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
        user.loginAttempts = 0; // Reset count for next cycle
      }
      await user.save({ validateBeforeSave: false });
      
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'Active') {
      return res.status(401).json({ success: false, message: 'Account is disabled, please contact admin' });
    }

    // MFA Check
    if (user.mfaEnabled) {
      if (!mfaToken) {
        return res.status(200).json({ 
          success: true, 
          requireMfa: true, 
          message: 'MFA token required' 
        });
      }
      
      const { authenticator } = require('otplib');
      const isValid = authenticator.check(mfaToken, user.mfaSecret);
      
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid MFA token' });
      }
    }
    
    // Check Email Verification
    // Bypassing for administrative and operational roles (MainAdmin, MainOrganiser, SubOrganiser, Staff, Volunteer, Auditor)
    const INTERNAL_ROLES = ['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor'];
    const isInternalRole = INTERNAL_ROLES.includes(user.role);

    if (user.isVerified === false && !isInternalRole) {
      return res.status(403).json({ success: false, message: 'Please verify your email address to log in.' });
    }

    // Check Temporary Password
    if (user.isTempPassword) {
      const tempToken = jwt.sign({ id: user._id, isTemp: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
      return res.status(403).json({ 
        success: false, 
        requirePasswordChange: true, 
        tempToken,
        message: 'You must change your temporary password before logging in.' 
      });
    }

    user.lastLogin = new Date();
    await sendTokens(user, 200, res);
  } catch (err) { next(err); }
});

// POST /api/auth/register
router.post('/register', [
  body('name').notEmpty().withMessage('Full name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('phone').optional({ checkFalsy: true }),
  body('password').isLength({ min: 8 }).withMessage('Password must be 8+ characters'),
  body('role').equals('Attendee').withMessage('Registration restricted to standard users only'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { name, email, phone, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ 
          success: false, 
          message: 'An account with this email already exists and is verified. Please log in or reset your password.' 
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'An account with this email already exists but is not yet verified. Please check your inbox for the verification link.' 
        });
      }
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const user = await User.create({ 
      name, 
      email, 
      phone, 
      password, 
      role, 
      status: 'Active',
      isVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email/${verificationToken}`;

    await notificationService.notifyVerification(user, verifyUrl);

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful. Please check your email to verify your account.' 
    });
  } catch (err) { next(err); }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (err) { next(err); }
});

// POST /api/auth/change-temp-password
router.post('/change-temp-password', [
  body('tempToken').notEmpty().withMessage('Temporary token required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be 8+ characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { tempToken, newPassword } = req.body;
    
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired temporary token.' });
    }

    if (!decoded.isTemp) {
      return res.status(401).json({ success: false, message: 'Invalid token type.' });
    }

    const user = await User.findById(decoded.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User no longer exists.' });
    }

    user.password = newPassword;
    user.isTempPassword = false;
    user.lastLogin = new Date();
    // Also mark as verified since they had a valid temp token from an admin
    user.isVerified = true;
    await user.save();

    await sendTokens(user, 200, res);
  } catch (err) { next(err); }
});

// POST /api/auth/refresh-token
router.post('/refresh-token', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    if (user.status !== 'Active') {
      return res.status(401).json({ success: false, message: 'Account is disabled, please contact admin' });
    }

    const accessToken = signAccessToken(user._id);
    res.json({ success: true, accessToken });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
    }
    
    res.cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000), // 10 seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('assignedEvents', 'name status startDate');
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// MFA Routes
// POST /api/auth/mfa/setup
router.post('/mfa/setup', protect, async (req, res, next) => {
  try {
    const { authenticator } = require('otplib');
    const qrcode = require('qrcode');
    
    const secret = authenticator.generateSecret();
    const user = await User.findById(req.user.id);
    
    user.mfaSecret = secret;
    await user.save({ validateBeforeSave: false });
    
    const otpauth = authenticator.keyuri(user.email, 'ENTRYNEX-HighFidelity', secret);
    const qrImage = await qrcode.toDataURL(otpauth);
    
    res.json({ success: true, qrImage, secret });
  } catch (err) { next(err); }
});

// POST /api/auth/mfa/activate
router.post('/mfa/activate', protect, [
  body('token').notEmpty().withMessage('MFA token required'),
], async (req, res, next) => {
  try {
    const { authenticator } = require('otplib');
    const user = await User.findById(req.user.id).select('+mfaSecret');
    
    const isValid = authenticator.check(req.body.token, user.mfaSecret);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid token. Activation failed.' });
    }
    
    user.mfaEnabled = true;
    await user.save({ validateBeforeSave: false });
    
    res.json({ success: true, message: 'MFA activated successfully.' });
  } catch (err) { next(err); }
});

// PATCH /api/auth/update-password
router.patch('/update-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be 8+ characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.comparePassword(req.body.currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    user.password = req.body.newPassword;
    await user.save();
    
    // Invalidate refresh tokens on password change
    user.refreshToken = undefined;
    await user.save({ validateBeforeSave: false });

    await sendTokens(user, 200, res);
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal that user doesn't exist
      return res.json({ success: true, message: 'If a user with that email exists, a reset link has been sent.' });
    }

    // Create reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    await notificationService.notifyPasswordReset(user, resetUrl);
    res.json({ success: true, message: 'Reset link sent to email.' });
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', [
  body('password').isLength({ min: 8 }).withMessage('Password must be 8+ characters'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Unflag temp password if they did a reset
    user.isTempPassword = false;
    user.isVerified = true; // Assume email is theirs if they reset password
    await user.save();

    await sendTokens(user, 200, res);
  } catch (err) { next(err); }
});

module.exports = router;
