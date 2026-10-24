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
          const foundTsc = String(user.tscNumber || user.tscNo || user.tsc);
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

// Migration function to populate missing subject combinations on existing User records
const runSubjectMigration = async () => {
  try {
    const Listing = require('./models/Listing');
    const User = require('./models/User');

    // Find users missing a valid subjectCombination
    const usersMissingSubjects = await User.find({
      $or: [
        { subjectCombination: { $exists: false } },
        { subjectCombination: '' },
        { subjectCombination: 'N/A' },
        { subjects: { $exists: false } },
      ],
    });

    if (usersMissingSubjects.length === 0) return;

    // Fetch all listings to build a quick subject reference map
    const listings = await Listing.find();
    let updatedUsersCount = 0;

    for (let user of usersMissingSubjects) {
      // Find matching listing by userId, tscNumber, or phone
      const matchingListing = listings.find((l) => {
        const isUserIdMatch = String(l.userId || l.user || '') === String(user._id);
        const isTscMatch = user.tscNumber && l.tscNumber && String(l.tscNumber).trim() === String(user.tscNumber).trim();
        const isPhoneMatch = user.phone && (l.phone || l.phoneNumber) && 
          String(l.phone || l.phoneNumber).trim() === String(user.phone).trim();

        return isUserIdMatch || isTscMatch || isPhoneMatch;
      });

      if (matchingListing) {
        const foundSubject = matchingListing.subjectCombination || 
                             matchingListing.subjects || 
                             matchingListing.subject;

        if (foundSubject && String(foundSubject).trim().toUpperCase() !== 'N/A') {
          const cleanSubject = String(foundSubject).trim();
          user.subjectCombination = cleanSubject;
          user.subjects = cleanSubject;
          user.subject = cleanSubject;
          await user.save();
          updatedUsersCount++;
        }
      }
    }

    if (updatedUsersCount > 0) {
      console.log(`Subject Migration completed: ${updatedUsersCount} user profile(s) updated with subject combinations.`);
    }
  } catch (err) {
    console.error('Subject Migration error:', err.message);
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
    
    // Run database migration scripts once connection is established
    await runTscMigration();
    await runSubjectMigration();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
};

// Middleware to ensure DB connection before executing routes
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ==========================================
// 3. Import Routes & Models
// ==========================================
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const listingsRoutes = require('./routes/listings');
const mpesaRoutes = require('./routes/mpesa');
const resourcesRoutes = require('./routes/resources');
const supportRoutes = require('./routes/support');
const uploadRoutes = require('./routes/upload');
const verifyTscRoutes = require('./routes/verifyTsc');
const Announcement = require('./models/Announcement');

// ==========================================
// 4. Mount API Routes
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/verify-tsc', verifyTscRoutes);

// Public GET endpoint to fetch the active broadcast announcement
app.get('/api/announcement/active', async (req, res) => {
  try {
    const activeNotice = await Announcement.findOne({ isActive: true });
    return res.status(200).json({
      success: true,
      announcement: activeNotice,
    });
  } catch (error) {
    console.error('Fetch Announcement Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch announcement' });
  }
});

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
