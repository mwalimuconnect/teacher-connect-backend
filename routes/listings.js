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

// GET /api/listings - Default to Swaps unless a query type is passed
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.type) {
      filter.type = { $regex: new RegExp(req.query.type, 'i') };
    } else {
      // DEFAULT FILTER: Only show Swap listings when no type parameter is supplied
      filter.$or = [
        { type: { $regex: /swap/i } },
        { type: { $exists: false } }, // Catches older records that didn't have a type key set
        { type: null }
      ];
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});
// GET /api/listings/type/:type - Fetch listings by category
router.get('/type/:type', async (req, res) => {
  try {
    const requestedType = req.params.type.toLowerCase();
    let typeQuery = {};

    if (requestedType.includes('swap')) {
      typeQuery = {
        $or: [
          { type: { $regex: /swap/i } },
          { category: { $regex: /swap/i } },
          { type: { $exists: false } }, // Catches older listings created without a type
          { type: null }
        ]
      };
    } else if (requestedType.includes('job') || requestedType.includes('vacancy') || requestedType.includes('bom')) {
      if (requestedType.includes('seeker')) {
        typeQuery = {
          $or: [
            { type: { $regex: /seeker|seeking/i } },
            { category: { $regex: /seeker|seeking/i } }
          ]
        };
      } else {
        typeQuery = {
          $or: [
            { type: { $regex: /vacancy|job|bom/i } },
            { category: { $regex: /vacancy|job|bom/i } }
          ]
        };
      }
    } else {
      typeQuery = {
        $or: [
          { type: { $regex: new RegExp(requestedType, 'i') } },
          { category: { $regex: new RegExp(requestedType, 'i') } }
        ]
      };
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
