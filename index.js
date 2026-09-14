const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import Auth Router from routes folder
const authRoutes = require('./routes/auth');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Base diagnostic endpoint
app.get('/', (req, res) => {
  res.send('TeacherConnect API is live!');
});

// Mount Auth Routes at /api/auth
app.use('/api/auth', authRoutes);

// MongoDB Atlas Connection
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch((err) => console.error('MongoDB Connection Error:', err));
} else {
  console.warn('MONGO_URI environment variable is missing in Vercel settings!');
}

// Export Express app for Vercel Serverless
module.exports = app;
