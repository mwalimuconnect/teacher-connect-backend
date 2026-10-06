const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const User = require('../models/User');

// Formatter to standardize listing object structures for Flutter client
const formatListing = (item) => {
  const doc = item._doc || item;
  const phoneVal = item.phone || item.contactPhone || item.phoneNumber || '';
  const schoolVal = item.currentSchool || item.school || item.schoolName || '';
  const nameVal = item.fullName || item.teacherName || item.userName || 'N/A';

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
      school: schoolVal,
    },
    currentCounty: item.county || item.currentCounty || 'N/A',
  };
};

// GET /api/admin/stats - Aggregated Admin Dashboard Counters
router.get('/stats', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments();
    const totalMembers = await User.countDocuments();

    // 1. Count user accounts requiring admin approval
    const pendingUsers = await User.countDocuments({
      $or: [
        { status: { $regex: /^pending$/i } },
        { isApproved: false },
      ],
    });

    // 2. Count listings requiring admin approval
    const pendingListings = await Listing.countDocuments({
      $or: [
        { status: { $regex: /^pending$/i } },
        { isApproved: false },
      ],
    });

    const totalPending = pendingUsers + pendingListings;

    res.status(200).json({
      success: true,
      totalListings: totalListings,
      totalCount: totalListings,
      total: totalListings,
      count: totalListings,
      pendingApprovals: totalPending,
      pendingCount: totalPending,
      paymentsReceived: 0,
      totalMembers: totalMembers,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      error: 'Failed to fetch admin stats',
      totalListings: 0,
      pendingApprovals: 0,
      totalMembers: 0,
    });
  }
});

// GET /api/admin/members - Fetch All Registered Members
router.get('/members', async (req, res) => {
  try {
    const members = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: members.length,
      members: members,
    });
  } catch (error) {
    console.error('Error fetching registered members:', error);
    res.status(500).json({ error: 'Failed to fetch registered members' });
  }
});

// GET /api/admin/pending-approvals - Fetch All 4 Pending Categories
router.get('/pending-approvals', async (req, res) => {
  try {
    const [pendingSwaps, pendingBomSeekers, pendingBomVacancies, pendingMembers] = await Promise.all([
      Listing.find({
        $and: [
          { $or: [{ category: { $regex: /swap/i } }, { type: { $regex: /swap/i } }] },
          { $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }] }
        ]
      }).sort({ createdAt: -1 }),

      Listing.find({
        $and: [
          { $or: [{ category: { $regex: /seeker|seeking/i } }, { type: { $regex: /seeker|seeking/i } }] },
          { $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }] }
        ]
      }).sort({ createdAt: -1 }),

      Listing.find({
        $and: [
          { $or: [{ category: { $regex: /vacancy|job/i } }, { type: { $regex: /vacancy|job/i } }] },
          { $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }] }
        ]
      }).sort({ createdAt: -1 }),

      User.find({
        $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }],
      })
        .select('-password')
        .sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      swaps: pendingSwaps.map(formatListing),
      bomSeekers: pendingBomSeekers.map(formatListing),
      bomVacancies: pendingBomVacancies.map(formatListing),
      members: pendingMembers,
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// POST /api/admin/approve - Approve Member or Listing Item
router.post('/approve', async (req, res) => {
  const { id, type } = req.body;

  try {
    if (type === 'member') {
      await User.findByIdAndUpdate(id, { status: 'approved', isApproved: true });
    } else {
      await Listing.findByIdAndUpdate(id, { status: 'approved', isApproved: true });
    }

    res.status(200).json({ success: true, message: 'Approved successfully' });
  } catch (error) {
    console.error('Error approving item:', error);
    res.status(500).json({ error: 'Failed to approve item' });
  }
});

// POST /api/admin/reject - Reject Member or Listing Item
router.post('/reject', async (req, res) => {
  const { id, type } = req.body;

  try {
    if (type === 'member') {
      await User.findByIdAndUpdate(id, { status: 'rejected', isApproved: false });
    } else {
      await Listing.findByIdAndUpdate(id, { status: 'rejected', isApproved: false });
    }

    res.status(200).json({ success: true, message: 'Rejected successfully' });
  } catch (error) {
    console.error('Error rejecting item:', error);
    res.status(500).json({ error: 'Failed to reject item' });
  }
});

// GET /api/admin/bom-vacancies
router.get('/bom-vacancies', async (req, res) => {
  try {
    const vacancies = await Listing.find({
      $or: [
        { type: { $regex: /vacancy|job/i } },
        { category: { $regex: /vacancy|job/i } },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json(vacancies.map(formatListing));
  } catch (error) {
    console.error('Error fetching BOM vacancies:', error);
    res.status(500).json({ error: 'Failed to fetch BOM vacancies' });
  }
});

// GET /api/admin/bom-seekers
router.get('/bom-seekers', async (req, res) => {
  try {
    const seekers = await Listing.find({
      $or: [
        { type: { $regex: /seeker|seeking/i } },
        { category: { $regex: /seeker|seeking/i } },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json(seekers.map(formatListing));
  } catch (error) {
    console.error('Error fetching BOM seekers:', error);
    res.status(500).json({ error: 'Failed to fetch BOM seekers' });
  }
});

// DELETE /api/admin/listing/:id
const deleteListingHandler = async (req, res) => {
  try {
    const deletedItem = await Listing.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
};

router.delete('/listing/:id', deleteListingHandler);
router.delete('/:id', deleteListingHandler);

module.exports = router;
