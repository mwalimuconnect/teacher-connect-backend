const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Essential Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Connect to MongoDB (Handles MONGO_URI and MONGODB_URI)
let isConnected = false;

// Migration function to update missing TSC numbers on existing database records
const runTscMigration = async () => {
  try {
    const Listing = require('./models/Listing');
    const User = require('./models/User');

    // Find documents missing valid TSC values
    const listings = await Listing.find({
      $or: [
        { tscNumber: { $exists: false } },
        { tscNumber: '' },
        { tscNumber: 'N/A' },
        { tscNo: '' },
      ],
    });

    let updatedCount = 0;
    for (let doc of listings) {
      const userId = doc.userId || doc.user;
      if (userId) {
        const user = await User.findById(userId);
        if (user && (user.tscNumber || user.tscNo || user.tsc)) {
          const foundTsc = String(user.tscNumber || user.tscNo || user.tsc).trim();
          doc.tscNumber = foundTsc;
          doc.tscNo = foundTsc;
          doc.tsc = foundTsc;
          doc.isTscCompliant = true;
          await doc.save();
          updatedCount++;
        }
      }
    }
    if (updatedCount > 0) {
      console.log(`TSC Migration completed: ${updatedCount} listing(s) updated.`);
    }
  } catch (err) {
    console.error('TSC Migration error:', err.message);
  }
};

const connectDB = async () => {
  if (isConnected) return;

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  try {
    if (!mongoUri) {
      throw new Error('Database URI is missing from environment variables');
    }
    const db = await mongoose.connect(mongoUri);
    isConnected = db.connections[0].readyState === 1;
    console.log('MongoDB connected successfully');

    // Run migration script once database connection is established
    await runTscMigration();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
};

// Middleware to ensure DB connection before executing routes
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

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
