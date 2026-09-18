const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// GET /api/listings - Fetch all listings or filter by query (e.g. ?type=BOM Job)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) {
      filter.type = req.query.type;
    }
    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    res.status(200).json(listings);
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// GET /api/listings/type/:type - Fetch listings by specific type
router.get('/type/:type', async (req, res) => {
  try {
    const listings = await Listing.find({ type: req.params.type }).sort({ createdAt: -1 });
    res.status(200).json(listings);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings by type' });
  }
});

// POST /api/listings - Handle listing submissions safely
router.post('/', async (req, res) => {
  try {
    const {
      type,
      fullName,
      teacherName,
      county,
      currentCounty,
      subCounty,
      subjectCombination,
      subject,
      phone,
      contactPhone,
      targetCounty,
      targetSubCounty,
      status
    } = req.body;

    const listingData = {
      type: type || 'TSC Swap',
      fullName: fullName || teacherName || 'Anonymous Teacher',
      county: county || currentCounty || 'Unspecified',
      subCounty: subCounty || 'Not Specified',
      subjectCombination: subjectCombination || subject || 'Not Specified',
      phone: phone || contactPhone || '',
      targetCounty: targetCounty || '',
      targetSubCounty: targetSubCounty || '',
      status: status || 'Pending'
    };

    const newListing = new Listing(listingData);
    const savedListing = await newListing.save();

    res.status(201).json({
      message: 'Listing created successfully',
      data: savedListing,
    });
  } catch (err) {
    console.error('Error saving listing:', err);
    res.status(400).json({ error: err.message || 'Failed to create listing' });
  }
});

module.exports = router;
