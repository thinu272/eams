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
const maintenanceMode = require("./middleware/maintenanceMode");
const { initializeCleanupScheduler } = require("./utils/s3Cleanup");

// Load environment variables
dotenv.config();

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
// Note: File uploads now go to S3 via s3Upload middleware
// Local uploads folder kept for backward compatibility
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/socket.io-client', express.static(path.join(__dirname, '../node_modules/socket.io/client-dist')));

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // allow frontend
});
app.set('io', io);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("join_dashboard", ({ eventId } = {}) => {
    if (eventId) {
      socket.join(`dashboard:${eventId}`);
    }
  });
  socket.on("join_event", ({ eventId } = {}) => {
    if (eventId) {
      socket.join(`event:${eventId}`);
      console.log(`Socket ${socket.id} joined event room: event:${eventId}`);
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
  // Listing page room — for real-time event listing updates
  socket.on("join_listings", () => {
    socket.join('listings');
  });
  socket.on("leave_listings", () => {
    socket.leave('listings');
  });
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

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
app.use('/api/buyer', require('./routes/buyerRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/sub', require('./routes/sub'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/devices', require('./routes/devices'));

// --- DATABASE CONNECTION ---
const MONGO_URI = process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    // Initialize S3 cleanup scheduler after database connection
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      initializeCleanupScheduler();
    }
  })
  .catch((err) => console.log("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 5000;
app.use(require('./middleware/errorHandler').notFound);
app.use(require('./middleware/errorHandler').errorHandler);
// Bind to localhost only for local-only development.
server.listen(PORT, '127.0.0.1', () => console.log(`Server running on port ${PORT}`));
