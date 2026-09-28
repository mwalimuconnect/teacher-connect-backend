const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

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

// GET /api/listings - Fetch all listings or by query parameter
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) {
      filter.type = { $regex: new RegExp(req.query.type, 'i') };
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    // If query string was provided, return array directly
    if (req.query.type) {
      return res.status(200).json(formatted);
    }

    // Default response supporting both array and wrapped object parsers
    res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// GET /api/listings/type/:type - Fetch listings by category (BOM Vacancies, Job Seekers, Swaps)
router.get('/type/:type', async (req, res) => {
  try {
    const requestedType = req.params.type;
    let typeQuery = {};

    if (/swap/i.test(requestedType)) {
      typeQuery = { type: { $regex: /swap/i } };
    } else if (/vacancy|job/i.test(requestedType) && !/seeker/i.test(requestedType)) {
      typeQuery = { type: { $regex: /vacancy|job/i } };
    } else if (/seeker|seeking/i.test(requestedType)) {
      typeQuery = { type: { $regex: /seeker|seeking/i } };
    } else {
      typeQuery = { type: { $regex: new RegExp(requestedType, 'i') } };
    }

    const listings = await Listing.find(typeQuery).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings by type' });
  }
});

module.exports = router;
