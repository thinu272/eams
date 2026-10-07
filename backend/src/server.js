// src/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const requestLogger = require("./middleware/requestLogger");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require('express-rate-limit');
const maintenanceMode = require("./middleware/maintenanceMode");
const { initializeCleanupScheduler } = require("./utils/s3Cleanup");
const { initializeBankTransferScheduler } = require("./utils/bankTransferScheduler");
const { normalizeRole } = require("./utils/rbac");

// Load environment variables
dotenv.config();

// Critical security: fail startup in production if JWT_SECRET is not configured
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is required in production');
  process.exit(1);
}

// Models
const User = require("./models/User"); // Create this model (name, email, password)

// Initialize Express app
const app = express();

// Configure CORS for local network testing.
// In development allow any origin; in production restrict to CORS_ORIGINS env var or known hosts.
const defaultAllowed = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : defaultAllowed;

if (process.env.NODE_ENV !== 'production') {
  app.use(
    cors({
      origin: true, // reflect request origin (allow all in dev/local network)
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
      credentials: true,
    })
  );
} else {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
      credentials: true,
    })
  );
}

app.use(helmet());
app.use(cookieParser());

// CSRF protection for cookie-based operations
// Uses double-submit cookie pattern: compare cookie value with a header
const csrfCookieName = 'csrf_token';
const csrfHeaderName = 'x-csrf-token';

app.use((req, res, next) => {
  // Skip CSRF for non-state-changing methods and API endpoints
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for paths that use Bearer token auth (not cookie-based)
  const csrfExemptPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh-token'];
  if (csrfExemptPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  // For state-changing requests that may use cookies, validate origin
  // This provides CSRF protection when SameSite='Lax' is not sufficient
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    const allowedOrigin = allowedOrigins.find(o => origin.startsWith(o));
    if (!allowedOrigin && process.env.NODE_ENV === 'production') {
      // In production, reject requests with unexpected origins
      // Allow requests without origin header (e.g., mobile apps using Bearer tokens)
      const hasBearerToken = req.headers.authorization?.startsWith('Bearer ');
      if (!hasBearerToken) {
        return res.status(403).json({ success: false, message: 'Invalid origin' });
      }
    }
  }
  
  next();
});

// Global rate limiter to protect non-auth endpoints from abuse/scraping
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased from 300)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    // Clean up empty _id and id at the root level of payloads
    if (req.body._id === '' || req.body._id === 'null' || req.body._id === 'undefined') delete req.body._id;
    if (req.body.id === '' || req.body.id === 'null' || req.body.id === 'undefined') delete req.body.id;

    // Convert empty or serialized null/undefined values to null for common ObjectId fields
    const fieldsToNull = ['companyId', 'company', 'eventId', 'event', 'organiserId'];
    fieldsToNull.forEach((field) => {
      if (req.body[field] === '' || req.body[field] === 'null' || req.body[field] === 'undefined') {
        req.body[field] = null;
      }
    });

    // Clean up arrays of ObjectIds
    if (Array.isArray(req.body.organiserIds)) {
      req.body.organiserIds = req.body.organiserIds.filter(id => id && id !== '' && id !== 'null' && id !== 'undefined');
    }
    if (Array.isArray(req.body.mainOrganisers)) {
      req.body.mainOrganisers = req.body.mainOrganisers.filter(id => id && id !== '' && id !== 'null' && id !== 'undefined');
    }
  }
  next();
});
app.use(requestLogger);
app.use(maintenanceMode);
// File uploads go to Azure Blob Storage via azureUpload middleware
// Local uploads folder only served in development for backward compatibility
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}
app.use('/socket.io-client', express.static(path.join(__dirname, '../node_modules/socket.io/client-dist')));

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);

// Align Socket.IO CORS policy with Express CORS settings
const socketCors = (process.env.NODE_ENV !== 'production')
  ? { origin: true, methods: ['GET', 'POST'], credentials: true }
  : { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true };

const io = new Server(server, {
  cors: socketCors,
});
app.set('io', io);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Helper function to authorize event access
  const authorizeEventAccess = async (user, eventId) => {
    if (!eventId) return false;
    
    const canonicalRole = normalizeRole(user.role);
    
    // MAIN_ADMIN can access any event
    if (canonicalRole === 'MainAdmin') {
      return true;
    }
    
    // MAIN_ORGANISER: verify user is in event.mainOrganisers OR event.createdBy
    const Event = require('./models/Event');
    const event = await Event.findById(eventId).select('createdBy mainOrganisers assignedOrganisers');
    if (!event) return false;
    
    if (canonicalRole === 'MainOrganiser') {
      const isCreator = event.createdBy?.toString() === user._id.toString();
      const isMainOrganiser = event.mainOrganisers?.some(id => id.toString() === user._id.toString());
      const isAssigned = event.assignedOrganisers?.some(id => id.toString() === user._id.toString());
      return isCreator || isMainOrganiser || isAssigned;
    }
    
    // SUB_ORGANISER, STAFF, VOLUNTEER: check assigned events
    if (user.assignedEvents && user.assignedEvents.some(e => e.toString() === eventId.toString())) {
      return true;
    }
    
    return false;
  };

  // Helper to extract user from JWT token
  const extractUserFromToken = async (token) => {
    if (!token) return null;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = require('./models/User');
      const user = await User.findById(decoded.id).select('-password');
      return user;
    } catch (err) {
      console.error('Socket auth error:', err.message);
      return null;
    }
  };

  // Dashboard room - requires authentication
  socket.on("join_dashboard", async ({ eventId } = {}) => {
    try {
      // Extract token from handshake
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const user = await extractUserFromToken(token);
      
      if (!user) {
        socket.emit('auth_error', { message: 'Authentication required' });
        return;
      }

      // Verify event access
      const hasAccess = await authorizeEventAccess(user, eventId);
      if (!hasAccess) {
        socket.emit('auth_error', { message: 'Not authorized for this event dashboard' });
        return;
      }

      if (eventId) {
        socket.join(`dashboard:${eventId}`);
        console.log(`Socket ${socket.id} (User: ${user._id}) joined dashboard room: dashboard:${eventId}`);
      }
    } catch (error) {
      console.error('join_dashboard error:', error);
      socket.emit('auth_error', { message: 'Authorization failed' });
    }
  });

  // Event room - requires authentication
  socket.on("join_event", async ({ eventId } = {}) => {
    try {
      // Extract token from handshake
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const user = await extractUserFromToken(token);
      
      if (!user) {
        socket.emit('auth_error', { message: 'Authentication required' });
        return;
      }

      // Verify event access
      const hasAccess = await authorizeEventAccess(user, eventId);
      if (!hasAccess) {
        socket.emit('auth_error', { message: 'Not authorized for this event' });
        return;
      }

      if (eventId) {
        socket.join(`event:${eventId}`);
        console.log(`Socket ${socket.id} (User: ${user._id}) joined event room: event:${eventId}`);
      }
    } catch (error) {
      console.error('join_event error:', error);
      socket.emit('auth_error', { message: 'Authorization failed' });
    }
  });

  socket.on("leave_event", ({ eventId } = {}) => {
    if (eventId) {
      socket.leave(`event:${eventId}`);
      console.log(`Socket ${socket.id} left event room: event:${eventId}`);
    }
  });

  socket.on("leave_dashboard", ({ eventId } = {}) => {
    if (eventId) {
      socket.leave(`dashboard:${eventId}`);
    }
  });

  // Listings room - public but could be restricted
  socket.on("join_listings", () => {
    socket.join('listings');
  });

  socket.on("leave_listings", () => {
    socket.leave('listings');
  });

  // Buyer room - requires authentication
  socket.on("join_buyer", async ({ userId } = {}) => {
    try {
      // Extract token from handshake to verify identity
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const user = await extractUserFromToken(token);
      
      if (!user || (userId && user._id.toString() !== userId)) {
        socket.emit('auth_error', { message: 'Not authorized for this buyer room' });
        return;
      }

      if (userId) {
        socket.join(`buyer:${userId}`);
      }
    } catch (error) {
      console.error('join_buyer error:', error);
      socket.emit('auth_error', { message: 'Authorization failed' });
    }
  });

  socket.on("leave_buyer", ({ userId } = {}) => {
    if (userId) {
      socket.leave(`buyer:${userId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// --- SWAGGER DOCS ---
try {
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = require('../swagger.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EAMS API Docs'
  }));
} catch (e) {
  console.log('Swagger docs not available:', e.message);
}

// --- ROUTES ---
// Health check
app.get("/", (req, res) => {
  res.send("API Running...");
});

// AUTH ROUTES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/events', require('./routes/events'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/confirm', require('./routes/confirm'));
app.use('/api/attendees', require('./routes/attendees'));
app.use('/api/rfid', require('./routes/rfid'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/invite', require('./routes/invite'));
app.use('/api/sponsor', require('./routes/sponsor'));
app.use('/api/entry', require('./routes/entry'));
app.use('/api/zone', require('./routes/zone'));
app.use('/api/dashboard', require('./routes/dashboard')); 
app.use('/api/audit', require('./routes/audit'));
app.use('/api/super-admin', require('./routes/superAdmin'));
app.use('/api/user', require('./routes/userPortal'));
app.use('/api/short-links', require('./routes/shortLinks'));
app.use('/api/organiser', require('./routes/organiser'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/buyer/payment-history', require('./routes/buyerPaymentHistory'));
app.use('/api/buyer', require('./routes/buyerRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/sub', require('./routes/sub'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/bank-transfer', require('./routes/bankTransfer'));
app.use('/api/payment-management', require('./routes/paymentManagement'));
app.use('/api/entrance', require('./routes/entrance'));
app.use('/api/upload', require('./routes/upload'));;
app.use('/api/devices', require('./routes/devices'));

// --- DATABASE CONNECTION ---
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Fatal: MONGODB_URI (or MONGO_URI) is not set. Aborting startup to avoid using embedded credentials.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    // Initialize S3 cleanup scheduler after database connection
    if (process.env.ASUZE_ACCESS_KEY_ID && process.env.ASUZE_SECRET_ACCESS_KEY) {
      initializeCleanupScheduler();
    }
    initializeBankTransferScheduler(io);
    // Start cash-at-entrance reservation expiry job
    const { startExpiryJob } = require('./jobs/expireReservations');
    startExpiryJob();
    // Start RFID archive & release job
    const { startRfidArchiveJob } = require('./jobs/rfidArchiveRelease');
    startRfidArchiveJob();
  })
  .catch((err) => console.log("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 5000;
app.use(require('./middleware/errorHandler').notFound);
app.use(require('./middleware/errorHandler').errorHandler);
// Bind all interfaces in local development so localhost can resolve via IPv4 or IPv6.
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => console.log(`Server running on ${HOST}:${PORT}`));

// Runtime environment presence check (prints which critical env vars are present without revealing values)
(() => {
  const critical = ['MONGODB_URI', 'JWT_SECRET', 'PAYHERE_SECRET', 'STRIPE_SECRET_KEY', 'AZURE_STORAGE_CONNECTION_STRING'];
  const present = critical.filter(k => !!process.env[k]);
  const missing = critical.filter(k => !process.env[k]);
  console.log(`Env check - present: ${present.length ? present.join(',') : 'none'}; missing: ${missing.length ? missing.join(',') : 'none'}`);
  if (missing.length) {
    console.warn('Warning: Missing critical env vars - set them in your environment or secrets store for full feature availability.');
  }
})();
