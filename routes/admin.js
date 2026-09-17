const express = require('express');
const router = express.Router();

const Listing = require('../models/Listing');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments();
    const pendingApprovals = await Listing.countDocuments({ status: 'pending' });
    const totalPayments = 0; // Placeholder until Payment model is added

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
