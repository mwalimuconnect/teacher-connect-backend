const express = require('express');
const router = express.Router();
const Listing = require('../models/listing');

// Helper to format listing data consistently
const formatListing = (item) => {
  const doc = item._doc || item;
  const phoneVal = item.phone || item.contactPhone || item.phoneNumber || item.contactNumber || 'N/A';
  const schoolVal = item.currentSchool || item.school || item.schoolName || 'N/A';
  const nameVal = item.fullName || item.teacherName || 'N/A';

  return {
    ...doc,
    teacherName: nameVal,
    fullName: nameVal,
    phone: phoneVal,
    phoneNumber: phoneVal,
    contactNumber: phoneVal,
    currentSchool: schoolVal,
    school: schoolVal,
    user: {
      name: nameVal,
      phone: phoneVal,
      school: schoolVal
    },
    currentCounty: item.county || item.currentCounty || 'N/A'
  };
};

// GET /api/listings - Fetch all listings or filter by query string ?type=...
router.get('/', async (req, res) => {
  try {
    const filter = {};
    const queryType = req.query.type;

    if (queryType) {
      if (/swap/i.test(queryType)) {
        filter.type = { $regex: /swap/i };
      } else if (/vacancy|job/i.test(queryType) && !/seeker/i.test(queryType)) {
        filter.type = { $regex: /vacancy|job/i };
      } else if (/seeker|seeking/i.test(queryType)) {
        filter.type = { $regex: /seeker|seeking/i };
      } else {
        filter.type = { $regex: new RegExp(queryType, 'i') };
      }
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// GET /api/listings/type/:type - Tab Endpoint matching App requests
router.get('/type/:type', async (req, res) => {
  try {
    const requestedType = req.params.type;
    let typeQuery = {};

    if (/swap/i.test(requestedType)) {
      // TSC Swap Tab: matches 'swap', 'tsc_swap', etc.
      typeQuery = { type: { $regex: /swap/i } };
    } else if (/vacancy|job/i.test(requestedType) && !/seeker/i.test(requestedType)) {
      // BOM Jobs Tab: matches 'vacancy', 'job', 'bom_vacancy'
      typeQuery = { type: { $regex: /vacancy|job/i } };
    } else if (/seeker|seeking/i.test(requestedType)) {
      // Seeking BOM Tab: matches 'seeker', 'seeking', 'bom_seeker'
      typeQuery = { type: { $regex: /seeker|seeking/i } };
    } else {
      typeQuery = { type: { $regex: new RegExp(requestedType, 'i') } };
    }

    const listings = await Listing.find(typeQuery).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings by type' });
  }
});

module.exports = router;
