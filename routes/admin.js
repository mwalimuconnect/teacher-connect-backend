const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Listing = require('../models/Listing');
const User = require('../models/User');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments();

    // Case-insensitive regex to capture both 'Pending' and 'pending'
    const pendingApprovals = await Listing.countDocuments({
      status: { $regex: /^pending$/i }
    });

    const totalMembers = await User.countDocuments();

    let totalPayments = 0;
    try {
      // Safely access the Payment model registered with Mongoose
      const PaymentModel = mongoose.models.Payment;

      if (PaymentModel) {
        const paymentResult = await PaymentModel.aggregate([
          { $match: { status: { $regex: /^completed$/i } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        if (paymentResult && paymentResult.length > 0) {
          totalPayments = paymentResult[0].total;
        }
      }
    } catch (e) {
      console.error('Payment aggregation skipped:', e.message);
      totalPayments = 0;
    }

    res.status(200).json({
      success: true,
      totalListings,
      pendingApprovals,
      totalPayments,
      paymentsReceived: totalPayments,
      totalMembers,
      data: {
        totalListings,
        pendingApprovals,
        totalPayments,
        paymentsReceived: totalPayments,
        totalMembers
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to compute stats' });
  }
});

// GET /api/admin/pending-listings
router.get('/pending-listings', async (req, res) => {
  try {
    const pendingListings = await Listing.find({
      status: { $regex: /^pending$/i }
    }).sort({ createdAt: -1 });

    res.status(200).json(pendingListings);
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
      { status: status || 'Approved' },
      { new: true }
    );
    res.status(200).json(updatedListing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update listing status' });
  }
});

// GET /api/admin/bom-vacancies
router.get('/bom-vacancies', async (req, res) => {
  try {
    const vacancies = await Listing.find({
      type: { $regex: /bom_vacancy/i }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vacancies.length,
      listings: vacancies,
      data: vacancies
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch BOM vacancies' });
  }
});

// GET /api/admin/bom-seekers
router.get('/bom-seekers', async (req, res) => {
  try {
    const seekers = await Listing.find({
      type: { $regex: /bom_seeker/i }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: seekers.length,
      listings: seekers,
      data: seekers
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch BOM job seekers' });
  }
});

// DELETE /api/admin/listing/:id
router.delete('/listing/:id', async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
