const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Uniform listing formatter for Flutter parsing
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

// GET /api/admin/stats - Aggregated Admin Dashboard Counters
router.get('/stats', async (req, res) => {
  try {
    // Count ALL records across the entire Listing collection (Swaps + BOM Vacancies + BOM Seekers)
    const totalListings = await Listing.countDocuments({});

    // Count pending approvals regardless of category casing
    const pendingApprovals = await Listing.countDocuments({
      status: { $regex: /^pending$/i }
    });

    // Provide multiple key variations so Flutter parses the count correctly regardless of field name
    res.status(200).json({
      success: true,
      totalListings: totalListings,
      totalCount: totalListings,
      total: totalListings,
      count: totalListings,
      pendingApprovals: pendingApprovals,
      pendingCount: pendingApprovals,
      paymentsReceived: 0
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch admin stats',
      totalListings: 0,
      pendingApprovals: 0 
    });
  }
});

// GET /api/admin/bom-vacancies - Fetch all BOM Vacancies
router.get('/bom-vacancies', async (req, res) => {
  try {
    const vacancies = await Listing.find({
      type: { $regex: /vacancy|job/i }
    }).sort({ createdAt: -1 });

    res.status(200).json(vacancies.map(formatListing));
  } catch (error) {
    console.error('Error fetching BOM vacancies:', error);
    res.status(500).json({ error: 'Failed to fetch BOM vacancies' });
  }
});

// GET /api/admin/bom-seekers - Fetch all BOM Job Seekers
router.get('/bom-seekers', async (req, res) => {
  try {
    const seekers = await Listing.find({
      type: { $regex: /seeker|seeking/i }
    }).sort({ createdAt: -1 });

    res.status(200).json(seekers.map(formatListing));
  } catch (error) {
    console.error('Error fetching BOM seekers:', error);
    res.status(500).json({ error: 'Failed to fetch BOM seekers' });
  }
});

// GET /api/admin/pending-listings - Fetch Pending Approvals
router.get('/pending-listings', async (req, res) => {
  try {
    const pendingListings = await Listing.find({
      status: { $regex: /^pending$/i }
    }).sort({ createdAt: -1 });

    res.status(200).json(pendingListings.map(formatListing));
  } catch (error) {
    console.error('Error fetching pending listings:', error);
    res.status(500).json({ error: 'Failed to fetch pending listings' });
  }
});

// DELETE /api/admin/listing/:id - Delete listing
router.delete('/listing/:id', async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
