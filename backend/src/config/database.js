'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger'); // assumes .info/.warn/.error API

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    logger.error('MONGODB_URI is not set in the environment.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  mongoose.connection.on('error', (error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
  });
}

module.exports = connectDB;