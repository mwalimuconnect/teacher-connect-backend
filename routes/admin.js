const express = require('express');
const router = express.Router();

// Import your Mongoose models
const Listing = require('../models/Listing');
const Payment = require('../models/Payment');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    // 1. Count total swap listings
    const totalListings = await Listing.countDocuments();

    // 2. Count listings pending admin approval
    const pendingApprovals = await Listing.countDocuments({ status: 'pending' });

    // 3. Sum up total completed payments using MongoDB aggregation
    const paymentAggregation = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]);

    const totalPayments = paymentAggregation.length > 0 
      ? paymentAggregation[0].totalAmount 
      : 0;

    // Return the calculated metrics
    res.json({
      totalListings,
      pendingApprovals,
      totalPayments
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to compute dashboard stats' });
  }
});

module.exports = router;
