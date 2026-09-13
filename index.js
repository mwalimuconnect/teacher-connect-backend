const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(express.json());
app.use(cors());

// ===================================================
// 1. MONGODB CONNECTION HELPER
// ===================================================
const MONGO_URI = process.env.MONGODB_URI;

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }
  if (MONGO_URI) {
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log('Successfully connected to MongoDB');
  } else {
    console.warn('Warning: MONGODB_URI environment variable is missing.');
  }
}

// ===================================================
// 2. MONGOOSE LISTING SCHEMA & MODEL
// ===================================================
const listingSchema = new mongoose.Schema({
  teacherName: { type: String, required: true },
  subject: { type: String, required: true },
  currentCounty: { type: String, required: true },
  targetCounty: { type: String, required: true },
  contactPhone: { type: String, required: true },
  email: String,
}, { timestamps: true });

const Listing = mongoose.model('Listing', listingSchema);

// ===================================================
// 3. API ROUTE HANDLERS (PUT LATTER CODE HERE)
// ===================================================

// GET listings
app.get('/api/listings', async (req, res) => {
  try {
    await connectDB(); // Ensure DB is connected first
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST new listing
app.post('/api/listings', async (req, res) => {
  try {
    await connectDB(); // Ensure DB is connected first
    const listing = new Listing(req.body);
    const savedListing = await listing.save();
    res.status(201).json(savedListing);
  } catch (err) {
    console.error('Error saving listing:', err);
    res.status(500).json({ error: err.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Teacher Connect API is running!');
});

// Export or listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
