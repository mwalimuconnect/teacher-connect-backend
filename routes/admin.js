const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Helper to format listing data for Flutter UI
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

// GET /api/admin/stats - Admin Dashboard Overview Counters
router.get('/stats', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments({});
    const pendingApprovals = await Listing.countDocuments({
      status: { $regex: /^pending$/i }
    });

    res.status(200).json({
      success: true,
      totalListings,
      totalCount: totalListings,
      pendingApprovals,
      pendingCount: pendingApprovals,
      paymentsReceived: 0
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/bom-vacancies - Fetch all BOM Vacancy posts
router.get('/bom-vacancies', async (req, res) => {
  try {
    const vacancies = await Listing.find({
      type: { $regex: /vacancy|job/i }
    }).sort({ createdAt: -1 });

    const formatted = vacancies.map(formatListing);
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching BOM vacancies:', error);
    res.status(500).json({ error: 'Failed to fetch BOM vacancies' });
  }
});

// GET /api/admin/bom-seekers - Fetch all BOM Job Seeker posts
router.get('/bom-seekers', async (req, res) => {
  try {
    const seekers = await Listing.find({
      type: { $regex: /seeker|seeking/i }
    }).sort({ createdAt: -1 });

    const formatted = seekers.map(formatListing);
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching BOM seekers:', error);
    res.status(500).json({ error: 'Failed to fetch BOM seekers' });
  }
});

// GET /api/admin/pending-listings - Fetch all Pending Approvals
router.get('/pending-listings', async (req, res) => {
  try {
    const pendingListings = await Listing.find({
      status: { $regex: /^pending$/i }
    }).sort({ createdAt: -1 });

    const formatted = pendingListings.map(formatListing);
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching pending listings:', error);
    res.status(500).json({ error: 'Failed to fetch pending listings' });
  }
});

// DELETE /api/admin/listing/:id - Delete a listing
router.delete('/listing/:id', async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
