const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// GET /api/listings - Fetch all listings for the feed
router.get('/', async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.status(200).json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/listings - Handle listing submissions from Flutter
router.post('/', async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    const savedListing = await newListing.save();
    
    res.status(201).json({
      message: 'Listing created successfully',
      data: savedListing,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
