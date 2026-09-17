const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Maintain connection state across serverless calls
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  try {const mongoUri = process.env.MONGO_URI || "mongodb+srv://samueloino_db_user:minE2021@cluster0.uaxli8e.mongodb.net/teacherconnect?retryWrites=true&w=majority";
    const db = await mongoose.connect(mongoUri, {
      bufferCommands: false, // Prevents 10000ms buffering timeouts
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState;
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

// Ensure database connection middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Routes
app.use('/api/listings', require('./routes/listings'));
app.use('/api/admin', require('./routes/admin'));
