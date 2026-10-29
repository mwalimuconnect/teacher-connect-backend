const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');
const Announcement = require('../models/Announcement');

// Helper to standardize listing object structures for Flutter client
const formatListing = (item) => {
  if (!item) return null;
  const doc = item._doc || item;

  const phoneVal = item.phone || item.contactPhone || item.phoneNumber || '';
  const schoolVal = item.currentSchool || item.school || item.schoolName || '';
  const nameVal = item.fullName || item.teacherName || item.userName || (item.user && item.user.fullName) || 'N/A';
  const subjectsVal = item.subjectCombination || item.subjects || item.subject || 'N/A';

  // Extract TSC Number across possible property names
  let tscVal = item.tscNumber || item.tscNo || item.tsc || item.tsc_number || (item.user && item.user.tscNumber) || '';
  if (tscVal) {
    tscVal = String(tscVal).trim();
  }

  let targetVal = item.targetLocation || '';
  if (!targetVal) {
    if (item.targetCounty && item.targetSubCounty) {
      targetVal = `${item.targetCounty} (${item.targetSubCounty})`;
    } else if (item.targetCounty) {
      targetVal = item.targetCounty;
    } else if (item.targetSubCounty) {
      targetVal = item.targetSubCounty;
    }
  }

  const categoryType = item.type || item.category || 'TSC Swap';
  const isApprovedStatus = item.isApproved === true || item.status === 'approved';

  return {
    ...doc,
    _id: String(item._id || item.id || ''),
    id: String(item._id || item.id || ''),
    teacherName: nameVal,
    fullName: nameVal,
    phone: phoneVal,
    phoneNumber: phoneVal,
    contactPhone: phoneVal,
    tscNumber: tscVal,
    tscNo: tscVal,
    tsc: tscVal,
    currentSchool: schoolVal,
    school: schoolVal,
    schoolName: schoolVal,
    subjectCombination: subjectsVal,
    subjects: subjectsVal,
    subject: subjectsVal,
    targetLocation: targetVal,
    targetCounty: item.targetCounty || targetVal,
    targetSubCounty: item.targetSubCounty || '',
    county: item.county || item.currentCounty || 'N/A',
    currentCounty: item.currentCounty || item.county || 'N/A',
    type: categoryType,
    category: categoryType,
    isApproved: isApprovedStatus,
    status: isApprovedStatus ? 'approved' : (item.status || 'pending'),
    isPaid: item.isPaid === true,
    user: {
      name: nameVal,
      phone: phoneVal,
      school: schoolVal,
      tscNumber: tscVal,
    },
  };
};

// =========================================================
// 1. GET /api/admin/stats - Aggregated Admin Dashboard Counters
// =========================================================
router.get('/stats', async (req, res) => {
  try {
    const [totalListings, totalMembers, pendingUsers, pendingListings, totalSupportTickets] = await Promise.all([
      Listing.countDocuments(),
      User.countDocuments({ isApproved: true }), // Only count approved members in total members
      User.countDocuments({
        $or: [
          { status: { $regex: /^pending$/i } },
          { isApproved: false }
        ]
      }),
      Listing.countDocuments({
        $or: [
          { status: { $regex: /^pending$/i } },
          { isApproved: false }
        ]
      }),
      SupportTicket.countDocuments()
    ]);

    const totalPending = pendingUsers + pendingListings;

    return res.status(200).json({
      success: true,
      totalListings,
      totalCount: totalListings,
      pendingApprovals: totalPending,
      pendingCount: totalPending,
      paymentsReceived: 0,
      totalMembers,
      totalSupportTickets,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch admin stats',
      totalListings: 0,
      pendingApprovals: 0,
      paymentsReceived: 0,
      totalMembers: 0,
      totalSupportTickets: 0,
    });
  }
});

// =========================================================
// 2. GET /api/admin/members - Fetch All Approved Registered Members
// =========================================================
router.get('/members', async (req, res) => {
  try {
    const [members, listings] = await Promise.all([
      User.find({ isApproved: true }).select('-password').sort({ createdAt: -1 }),
      Listing.find()
    ]);

    // Build a lookup dictionary mapping TSC numbers and phones to their listing subjects
    const listingSubjectMap = {};
    listings.forEach(l => {
      const subj = l.subjectCombination || l.subjects || l.subject;
      if (subj && typeof subj === 'string' && subj.trim().toUpperCase() !== 'N/A') {
        if (l.tscNumber) listingSubjectMap[l.tscNumber.trim()] = subj.trim();
        if (l.phone) listingSubjectMap[l.phone.trim()] = subj.trim();
        if (l.phoneNumber) listingSubjectMap[l.phoneNumber.trim()] = subj.trim();
      }
    });

    const formattedMembers = members.map((member) => {
      const doc = member._doc || member;
      
      let rawSubject = 
        member.subjectCombination || 
        member.subjects || 
        member.subject || 
        member.teachingSubjects || 
        doc.subjectCombination ||
        doc.subjects ||
        doc.subject ||
        listingSubjectMap[doc.tscNumber?.trim()] ||
        listingSubjectMap[doc.phone?.trim()] ||
        listingSubjectMap[doc.phoneNumber?.trim()] ||
        'N/A';

      if (Array.isArray(rawSubject)) {
        rawSubject = rawSubject.filter(Boolean).join(', ');
      }
      
      const subjectStr = (rawSubject && String(rawSubject).trim().length > 0 && String(rawSubject).trim().toUpperCase() !== 'N/A') 
        ? String(rawSubject).trim() 
        : 'N/A';

      return {
        ...doc,
        id: String(member._id || member.id || ''),
        _id: String(member._id || member.id || ''),
        canEditTsc: member.canEditTsc || false, // Pass permission flag to Flutter Admin UI
        subjectCombination: subjectStr,
        subjects: subjectStr,
        subject: subjectStr,
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedMembers.length,
      members: formattedMembers,
    });
  } catch (error) {
    console.error('Error fetching registered members:', error);
    return res.status(500).json({ error: 'Failed to fetch registered members' });
  }
});

// =========================================================
// 2B. PUT /api/admin/grant-identity-edit/:id - Grant or Revoke Edit Permission
// =========================================================
router.put('/grant-identity-edit/:id', async (req, res) => {
  try {
    // Explicitly coerce incoming value into a strict boolean
    const rawValue = req.body.canEditTsc;
    const canEditVal = rawValue === true || rawValue === 'true' || rawValue === 1;
    const userId = req.params.id;

    // Use $set to force MongoDB to persist the boolean state change
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { canEditTsc: canEditVal } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: updatedUser.canEditTsc
        ? 'Identity edit permission granted successfully.'
        : 'Identity edit permission revoked successfully.',
      user: {
        ...updatedUser._doc,
        id: String(updatedUser._id),
        canEditTsc: updatedUser.canEditTsc,
      },
    });
  } catch (error) {
    console.error('Toggle Identity Edit Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================
// 3. GET /api/admin/pending-approvals - Fetch All Pending Categories
// =========================================================
router.get('/pending-approvals', async (req, res) => {
  try {
    const [pendingSwaps, pendingBomSeekers, pendingBomVacancies, pendingMembers] = await Promise.all([
      Listing.find({
        $and: [
          { $or: [{ category: { $regex: /swap/i } }, { type: {$regex: /swap/i } }] },
          { $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }] }
        ]
      }).sort({ createdAt: -1 }),

      Listing.find({
        $and: [
          { $or: [{ category: { $regex: /seeker|seeking/i } }, { type: {$regex: /seeker|seeking|job/i } }] },
          { $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }] }
        ]
      }).sort({ createdAt: -1 }),

      Listing.find({
        $and: [
          { $or: [{ category: { $regex: /vacancy|job/i } }, { type: {$regex: /vacancy|job/i } }] },
          { $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }] }
        ]
      }).sort({ createdAt: -1 }),

      User.find({
        $or: [{ status: { $regex: /^pending$/i } }, { isApproved: false }]
      })
      .select('-password')
      .sort({ createdAt: -1 })
    ]);

    return res.status(200).json({
      swaps: pendingSwaps.map(formatListing),
      bomSeekers: pendingBomSeekers.map(formatListing),
      bomVacancies: pendingBomVacancies.map(formatListing),
      members: pendingMembers,
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// =========================================================
// 4. POST /api/admin/approve - Approve Member or Listing Item
// =========================================================
router.post('/approve', async (req, res) => {
  const { id, type } = req.body;

  try {
    if (type === 'member') {
      await User.findByIdAndUpdate(id, { status: 'approved', isApproved: true });
    } else {
      await Listing.findByIdAndUpdate(id, { status: 'approved', isApproved: true });
    }

    return res.status(200).json({ success: true, message: 'Approved successfully' });
  } catch (error) {
    console.error('Error approving item:', error);
    return res.status(500).json({ error: 'Failed to approve item' });
  }
});

// =========================================================
// 5. POST /api/admin/reject - Reject Member or Listing Item
// =========================================================
router.post('/reject', async (req, res) => {
  const { id, type } = req.body;

  try {
    if (type === 'member') {
      await User.findByIdAndUpdate(id, { status: 'rejected', isApproved: false });
    } else {
      await Listing.findByIdAndUpdate(id, { status: 'rejected', isApproved: false });
    }

    return res.status(200).json({ success: true, message: 'Rejected successfully' });
  } catch (error) {
    console.error('Error rejecting item:', error);
    return res.status(500).json({ error: 'Failed to reject item' });
  }
});

// =========================================================
// 6. GET /api/admin/swaps - Fetch All TSC Swaps
// =========================================================
router.get('/swaps', async (req, res) => {
  try {
    const swaps = await Listing.find({
      $or: [
        { type: { $regex: /swap/i } },
        { category: { $regex: /swap/i } }
      ]
    }).sort({ createdAt: -1 });

    return res.status(200).json(swaps.map(formatListing));
  } catch (error) {
    console.error('Error fetching TSC swaps:', error);
    return res.status(500).json({ error: 'Failed to fetch TSC swaps' });
  }
});

// =========================================================
// 7. GET /api/admin/bom-vacancies - Fetch All BOM Vacancies
// =========================================================
router.get('/bom-vacancies', async (req, res) => {
  try {
    const vacancies = await Listing.find({
      $or: [
        { type: { $regex: /vacancy|job/i } },
        { category: { $regex: /vacancy|job/i } }
      ]
    }).sort({ createdAt: -1 });

    return res.status(200).json(vacancies.map(formatListing));
  } catch (error) {
    console.error('Error fetching BOM vacancies:', error);
    return res.status(500).json({ error: 'Failed to fetch BOM vacancies' });
  }
});

// =========================================================
// 8. GET /api/admin/bom-seekers - Fetch All BOM Seekers
// =========================================================
router.get('/bom-seekers', async (req, res) => {
  try {
    const seekers = await Listing.find({
      $or: [
        { type: { $regex: /seeker|seeking/i } },
        { category: { $regex: /seeker|seeking/i } }
      ]
    }).sort({ createdAt: -1 });

    return res.status(200).json(seekers.map(formatListing));
  } catch (error) {
    console.error('Error fetching BOM seekers:', error);
    return res.status(500).json({ error: 'Failed to fetch BOM seekers' });
  }
});

// =========================================================
// 9. DELETE /api/admin/listing/:id
// =========================================================
const deleteListingHandler = async (req, res) => {
  try {
    const deletedItem = await Listing.findByIdAndDelete(req.params.id);

    if (!deletedItem) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    return res.status(200).json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return res.status(500).json({ error: 'Failed to delete listing' });
  }
};

router.delete('/listings/:id', deleteListingHandler);
router.delete('/listing/:id', deleteListingHandler);
router.delete('/:id', deleteListingHandler);

// =========================================================
// 10. POST /api/admin/announcement - Create Broadcast Notice
// =========================================================
router.post('/announcement', async (req, res) => {
  try {
    const { title, message, authorName } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message content are required.',
      });
    }

    // Deactivate previous active announcements
    await Announcement.updateMany({ isActive: true }, { isActive: false });

    const newNotice = new Announcement({
      title: String(title).trim(),
      message: String(message).trim(),
      postedBy: authorName || 'Admin',
      isActive: true,
    });

    await newNotice.save();

    return res.status(201).json({
      success: true,
      message: 'Announcement posted successfully!',
      announcement: newNotice,
    });
  } catch (error) {
    console.error('Post Announcement Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while posting announcement.',
    });
  }
});

module.exports = router;
