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

module.exports = app;const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = 'https://teacher-connect-backend.vercel.app/api/callback';

const generateToken = async (req, res, next) => {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'M-Pesa Consumer Key or Secret is missing'
    });
  }

  try {
    const authHeader = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${authHeader}` } }
    );
    req.token = response.data.access_token;
    next();
  } catch (error) {
    console.error('M-Pesa Auth Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate with M-Pesa Daraja',
      details: error.response?.data || error.message
    });
  }
};

app.post('/api/stkpush', generateToken, async (req, res) => {
  let { phoneNumber, amount } = req.body;

  if (!phoneNumber || !amount) {
    return res.status(400).json({ success: false, message: 'Phone number and amount required' });
  }

  if (phoneNumber.startsWith('0')) {
    phoneNumber = '254' + phoneNumber.slice(1);
  } else if (phoneNumber.startsWith('+254')) {
    phoneNumber = phoneNumber.slice(1);
  }

  const date = new Date();
  const timestamp =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0');

  const password = Buffer.from(`${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`).toString('base64');

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: BUSINESS_SHORT_CODE,
        PhoneNumber: phoneNumber,
        CallBackURL: CALLBACK_URL,
        AccountReference: 'TeacherConnect',
        TransactionDesc: 'Payment'
      },
      { headers: { Authorization: `Bearer ${req.token}` } }
    );

    return res.status(200).json({
      success: true,
      ...response.data
    });
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'STK Push failed',
      error: error.response?.data || error.message
    });
  }
});

module.exports = app;
