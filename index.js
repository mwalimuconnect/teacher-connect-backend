const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Essential Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => console.error('MongoDB connection error:', err));
}

// 3. Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const listingsRoutes = require('./routes/listings');
const mpesaRoutes = require('./routes/mpesa');
const resourcesRoutes = require('./routes/resources');
const uploadRoutes = require('./routes/upload');

// 4. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('TeacherConnect API Server Running');
});

// 5. Start Server for Local Development
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel Serverless Execution
module.exports = app;
