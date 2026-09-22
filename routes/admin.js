const express = require('express');
const router = express.Router();

const Listing = require('../models/Listing');
const User = require('../models/User');
// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments({});
    const pendingApprovals = await Listing.countDocuments({ status: 'pending' });
    const totalMembers = await User.countDocuments({});
    
    let totalPayments = 0;
    try {
      const Payment = require('../models/Payment');
      const paymentResult = await Payment.aggregate([
        { $match: { status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      if (paymentResult.length > 0) {
        totalPayments = paymentResult[0].total;
      }
    } catch (e) {
      totalPayments = 0;
    }

    res.json({
      totalListings,
      pendingApprovals,
      totalPayments,
      totalMembers
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to compute stats' });
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
// GET /api/admin/bom-vacancies (Fetch all school vacancy posts)
router.get('/bom-vacancies', async (req, res) => {
  try {
    const vacancies = await Listing.find({ 
      type: { $regex: /bom_?vacancy/i } 
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

// GET /api/admin/bom-seekers (Fetch all teacher job seeker profiles)
router.get('/bom-seekers', async (req, res) => {
  try {
    const seekers = await Listing.find({ 
      type: { $regex: /bom_?seeker/i } 
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
// DELETE /api/admin/listing/:id (Delete any listing/vacancy)
router.delete('/listing/:id', async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});
module.exports = router;
