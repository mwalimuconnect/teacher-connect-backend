const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const mpesaRoutes = require('./routes/mpesa');
const resourceRoutes = require('./routes/resources');
const adminRoutes = require('./routes/admin');
const listingRoutes = require('./routes/listings');
const uploadRoutes = require('./routes/upload');

const app = express();

app.use(cors());
app.use(express.json());

// Serverless MongoDB Connection Cache
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  const db = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  
  isConnected = db.connections[0].readyState === 1;
  console.log('MongoDB connected successfully');
};

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed: ' + err.message
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/upload', uploadRoutes);

// Fallback 404 Route for unmatched endpoints
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`
  });
});

module.exports = app;
