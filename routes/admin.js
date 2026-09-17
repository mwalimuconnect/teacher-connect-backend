const express = require('express');
const router = express.Router();

const Listing = require('../models/Listing');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    // 1. Count total swap listings
    const totalListings = await Listing.countDocuments();

    // 2. Count listings pending admin approval
    const pendingApprovals = await Listing.countDocuments({ status: 'pending' });

    // 3. Temporary placeholder for total payments until Payment model is added
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

module.exports = router;
