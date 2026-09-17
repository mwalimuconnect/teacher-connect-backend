const express = require('express');
const router = express.Router();

const Listing = require('../models/Listing');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments();
    const pendingApprovals = await Listing.countDocuments({ status: 'pending' });
    const totalPayments = 0;

    res.json({
      totalListings,
      pendingApprovals,
      totalPayments
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to compute stats' });
  }
});

// GET /api/admin/pending-listings
router.get('/pending-listings', async (req, res) => {
  try {
    const pendingListings = await Listing.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(pendingListings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending listings' });
  }
});

// PATCH /api/admin/approve-listing/:id
router.patch('/approve-listing/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(updatedListing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update listing status' });
  }
});

module.exports = router;
