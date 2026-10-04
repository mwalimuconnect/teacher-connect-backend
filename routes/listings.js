const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing'); // Fixed case-sensitivity for Vercel/Linux

// Helper to format listing data consistently
const formatListing = (item) => {
  const doc = item._doc || item;

  const phoneVal = item.phone || item.contactPhone || item.phoneNumber || '';
  const schoolVal = item.currentSchool || item.school || item.schoolName || '';
  const nameVal = item.fullName || item.teacherName || 'N/A';

  // Extract Subject Combination properly from Listing schema
  const subjectsVal = item.subjectCombination || item.subjects || item.subject || 'N/A';

  // Format Target Location string nicely
  let targetVal = '';
  if (item.targetCounty && item.targetSubCounty) {
    targetVal = `${item.targetCounty} (${item.targetSubCounty})`;
  } else if (item.targetCounty) {
    targetVal = item.targetCounty;
  } else if (item.targetSubCounty) {
    targetVal = item.targetSubCounty;
  }

  return {
    ...doc,
    teacherName: nameVal,
    fullName: nameVal,
    phone: phoneVal,
    phoneNumber: phoneVal,
    contactNumber: phoneVal,
    currentSchool: schoolVal,
    school: schoolVal,
    subjectCombination: subjectsVal,
    subjects: subjectsVal,
    targetLocation: targetVal,
    user: {
      name: nameVal,
      phone: phoneVal,
      school: schoolVal,
    },
    currentCounty: item.county || item.currentCounty || 'N/A',
  };
};

// GET /api/listings - Fetch all listings or filter by query string ?type=
router.get('/', async (req, res) => {
  try {
    const filter = {};
    const queryType = req.query.type;

    if (queryType) {
      if (/swap/i.test(queryType)) {
        filter.type = 'TSC Swap';
      } else if ((/vacancy/i.test(queryType) || /job/i.test(queryType)) && !/seeker/i.test(queryType)) {
        filter.type = 'BOM Vacancy';
      } else if (/seeker/i.test(queryType) || /seeking/i.test(queryType)) {
        filter.type = 'Seeking BOM Job';
      } else {
        filter.type = new RegExp(queryType, 'i');
      }
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// GET /api/listings/type/:type - Tab Endpoint matching App requests
router.get('/type/:type', async (req, res) => {
  try {
    const requestedType = req.params.type;
    let typeQuery = {};

    if (/swap/i.test(requestedType)) {
      typeQuery = { type: 'TSC Swap' };
    } else if (/seeker/i.test(requestedType) || /seeking/i.test(requestedType)) {
      // Must check seeker FIRST so 'Seeking BOM Job' doesn't hit the vacancy check
      typeQuery = { type: 'Seeking BOM Job' };
    } else if (/vacancy/i.test(requestedType) || /job/i.test(requestedType)) {
      typeQuery = { type: 'BOM Vacancy' };
    } else {
      typeQuery = { type: new RegExp(requestedType, 'i') };
    }

    const listings = await Listing.find(typeQuery).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

module.exports = router;
