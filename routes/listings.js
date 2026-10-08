const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Helper to format listing data consistently for Flutter UI
const formatListing = (item) => {
  if (!item) return null;
  const doc = item._doc || item;

  const phoneVal = item.phone || item.contactPhone || item.phoneNumber || '';
  const schoolVal = item.currentSchool || item.school || item.schoolName || '';
  const nameVal = item.fullName || item.teacherName || item.userName || (item.user && item.user.name) || 'Teacher';
  const subjectsVal = item.subjectCombination || item.subjects || item.subject || '';

  // Safe TSC Number Extraction (Handles Strings and Numbers)
  let tscVal = item.tscNumber || item.tscNo || item.tsc || item.tsc_number || (item.user && item.user.tscNumber) || null;
  if (tscVal !== null && tscVal !== undefined) {
    tscVal = String(tscVal).trim();
  }

  // Extract target location string
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
  const approvedStatus = item.isApproved === true || item.status === 'approved';

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
    county: item.county || item.currentCounty || item.currentLocation || 'N/A',
    currentCounty: item.currentCounty || item.county || item.currentLocation || 'N/A',
    currentLocation: item.currentLocation || item.currentCounty || item.county || 'N/A',
    salary: item.salary || '',
    isTscCompliant: item.isTscCompliant === true || item.tscCompliant === true,
    type: categoryType,
    category: categoryType,
    isPaid: item.isPaid === true,
    isApproved: approvedStatus,
    status: approvedStatus ? 'approved' : (item.status || 'pending'),
    user: {
      name: nameVal,
      phone: phoneVal,
      school: schoolVal,
      tscNumber: tscVal,
    },
  };
};

// =========================================================================
// 1. GET ALL LISTINGS (WITH PAGINATION, CATEGORY FILTER, ADMIN BYPASS)
// =========================================================================
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100; // Default higher limit for admin tables
    const skip = (page - 1) * limit;
    const isAdmin = req.query.isAdmin === 'true';

    let filter = {};

    // Apply approval filter for public member feeds unless client is admin
    if (!isAdmin) {
      filter.$or = [
        { status: { $regex: /^approved$/i } },
        { status: { $exists: false } },
        { isApproved: true },
      ];
    }

    const queryType = req.query.type || req.query.category;

    if (queryType && queryType.toLowerCase() !== 'all') {
      let categoryFilter = [];

      if (/swap/i.test(queryType)) {
        categoryFilter = [{ type: 'TSC Swap' }, { category: 'TSC Swap' }];
      } else if (/vacancy|job/i.test(queryType) && !/seeker|seeking/i.test(queryType)) {
        categoryFilter = [{ type: 'BOM Vacancy' }, { category: 'BOM Vacancy' }, { type: 'BOM Jobs' }, { category: 'BOM Jobs' }];
      } else if (/seeker|seeking/i.test(queryType)) {
        categoryFilter = [{ type: 'Seeking BOM Job' }, { category: 'Seeking BOM Job' }, { type: 'Seeking BOM' }, { category: 'Seeking BOM' }];
      } else {
        const regex = new RegExp(queryType, 'i');
        categoryFilter = [{ type: regex }, { category: regex }];
      }

      if (filter.$or) {
        filter = {
          $and: [{$or: filter.$or }, {$or: categoryFilter }],
        };
      } else {
        filter.$or = categoryFilter;
      }
    }

    const listings = await Listing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalDocs = await Listing.countDocuments(filter);
    const formatted = listings.map(formatListing);

    return res.status(200).json({
      data: formatted,
      pagination: {
        total: totalDocs,
        page: page,
        pages: Math.ceil(totalDocs / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching listings:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch listings' });
  }
});

// =========================================================================
// 2. GET LISTINGS BY TAB TYPE (/api/listings/type/:type)
// =========================================================================
router.get('/type/:type', async (req, res) => {
  try {
    const requestedType = req.params.type;
    let typeQuery = {
      $or: [
        { status: { $regex: /^approved$/i } },
        { status: { $exists: false } },
        { isApproved: true },
      ],
    };

    if (requestedType && requestedType.toLowerCase() !== 'all') {
      let categoryFilter = [];

      if (/swap/i.test(requestedType)) {
        categoryFilter = [{ type: 'TSC Swap' }, { category: 'TSC Swap' }];
      } else if (/seeker|seeking/i.test(requestedType)) {
        categoryFilter = [{ type: 'Seeking BOM Job' }, { category: 'Seeking BOM Job' }, { type: 'Seeking BOM' }, { category: 'Seeking BOM' }];
      } else if (/vacancy|job/i.test(requestedType)) {
        categoryFilter = [{ type: 'BOM Vacancy' }, { category: 'BOM Vacancy' }, { type: 'BOM Jobs' }, { category: 'BOM Jobs' }];
      } else {
        const regex = new RegExp(requestedType, 'i');
        categoryFilter = [{ type: regex }, { category: regex }];
      }

      typeQuery = {
        $and: [{$or: typeQuery.$or }, {$or: categoryFilter }],
      };
    }

    const listings = await Listing.find(typeQuery).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch listings' });
  }
});

// =========================================================================
// 3. GET SINGLE LISTING BY ID (/api/listings/:id)
// =========================================================================
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    return res.status(200).json(formatListing(listing));
  } catch (err) {
    console.error('Error fetching listing:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 4. CREATE NEW LISTING (/api/listings)
// =========================================================================
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    const tscCaptured = body.tscNumber || body.tscNo || body.tsc || body.tsc_number || null;

    const listingData = {
      ...body,
      fullName: body.fullName || body.teacherName || 'Teacher',
      teacherName: body.teacherName || body.fullName || 'Teacher',
      phone: body.phone || body.contactPhone || body.phoneNumber || '',
      phoneNumber: body.phoneNumber || body.phone || body.contactPhone || '',
      contactPhone: body.contactPhone || body.phone || body.phoneNumber || '',
      subjectCombination: body.subjectCombination || body.subject || body.subjects || '',
      subject: body.subject || body.subjectCombination || body.subjects || '',
      county: body.county || body.currentCounty || body.currentLocation || '',
      currentCounty: body.currentCounty || body.county || body.currentLocation || '',
      currentLocation: body.currentLocation || body.currentCounty || body.county || '',
      targetCounty: body.targetCounty || body.desiredCounty || '',
      targetSubCounty: body.targetSubCounty || '',
      currentSchool: body.currentSchool || body.school || body.schoolName || '',
      schoolName: body.schoolName || body.currentSchool || body.school || '',
      tscNumber: tscCaptured,
      tscNo: tscCaptured,
      salary: body.salary || '',
      isTscCompliant: body.isTscCompliant === true || body.tscCompliant === true,
      type: body.type || body.category || body.listingCategory || 'TSC Swap',
      category: body.category || body.type || body.listingCategory || 'TSC Swap',
      status: body.status || 'pending',
      isApproved: body.isApproved === true || body.status === 'approved',
      createdAt: new Date(),
    };

    const newListing = new Listing(listingData);
    const savedListing = await newListing.save();

    return res.status(201).json({
      success: true,
      message: 'Listing created successfully and sent for approval',
      data: formatListing(savedListing),
    });
  } catch (err) {
    console.error('Error creating listing:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. UPDATE LISTING (/api/listings/:id)
// =========================================================================
const handleUpdate = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Explicitly sync approval state if status or isApproved passed
    if (updateData.status === 'approved' || updateData.isApproved === true) {
      updateData.status = 'approved';
      updateData.isApproved = true;
    }

    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: false }
    );

    if (!updatedListing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Listing updated successfully',
      data: formatListing(updatedListing),
    });
  } catch (err) {
    console.error('Error updating listing:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.put('/:id', handleUpdate);
router.patch('/:id', handleUpdate);

// =========================================================================
// 6. DELETE LISTING (/api/listings/:id)
// =========================================================================
router.delete('/:id', async (req, res) => {
  try {
    const deletedListing = await Listing.findByIdAndDelete(req.params.id);

    if (!deletedListing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Listing deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting listing:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
