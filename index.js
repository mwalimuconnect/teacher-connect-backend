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


app.use('/api/mpesa', mpesaRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/auth', authRoutes);

// Serverless MongoDB Connection Cache
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }
  
  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState === 1;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// Ensure database connection is active before processing routes
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// Routes
app.use('/api/listings', listingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/resources', resourceRoutes);

module.exports = app;

