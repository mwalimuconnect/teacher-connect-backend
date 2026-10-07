const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Helper to format listing data consistently for Flutter UI
const formatListing = (item) => {
  const doc = item._doc || item;

  const phoneVal = item.phone || item.contactPhone || item.phoneNumber || '';
  const schoolVal = item.currentSchool || item.school || item.schoolName || '';
  const nameVal = item.fullName || item.teacherName || item.userName || 'N/A';
  const subjectsVal = item.subjectCombination || item.subjects || item.subject || 'N/A';

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

  return {
    ...doc,
    _id: item._id,
    id: item._id,
    teacherName: nameVal,
    fullName: nameVal,
    phone: phoneVal,
    phoneNumber: phoneVal,
    contactNumber: phoneVal,
    currentSchool: schoolVal,
    school: schoolVal,
    subjectCombination: subjectsVal,
    subjects: subjectsVal,
    subject: subjectsVal,
    targetLocation: targetVal,
    targetCounty: item.targetCounty || targetVal,
    targetSubCounty: item.targetSubCounty || '',
    county: item.county || item.currentCounty || 'N/A',
    currentCounty: item.county || item.currentCounty || 'N/A',
    type: categoryType,
    category: categoryType,
    user: {
      name: nameVal,
      phone: phoneVal,
      school: schoolVal,
    },
  };
};

// =================================================================
// 1. GET ALL LISTINGS (WITH PAGINATION, CATEGORY FILTER, ADMIN OVERRIDE)
// =================================================================
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    const isAdmin = req.query.isAdmin === 'true';

    let filter = {};

    // Apply approval filter for public member feeds unless called by admin
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
      } else if (/vacancy|job/i.test(queryType) && !/seeker/i.test(queryType)) {
        categoryFilter = [{ type: 'BOM Vacancy' }, { category: 'BOM Vacancy' }];
      } else if (/seeker|seeking/i.test(queryType)) {
        categoryFilter = [{ type: 'Seeking BOM Job' }, { category: 'Seeking BOM Job' }];
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
    return res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// =================================================================
// 2. GET LISTINGS BY TAB TYPE (/api/listings/type/:type)
// =================================================================
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
        categoryFilter = [{ type: 'Seeking BOM Job' }, { category: 'Seeking BOM Job' }];
      } else if (/vacancy|job/i.test(requestedType)) {
        categoryFilter = [{ type: 'BOM Vacancy' }, { category: 'BOM Vacancy' }];
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
    return res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// =================================================================
// 3. GET SINGLE LISTING BY ID (/api/listings/:id)
// =================================================================
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    return res.status(200).json(formatListing(listing));
  } catch (err) {
    console.error('Error fetching listing:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =================================================================
// 4. CREATE NEW LISTING (/api/listings)
// =================================================================
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    const listingData = {
      ...body,
      fullName: body.fullName || body.teacherName || 'Teacher',
      teacherName: body.teacherName || body.fullName || 'Teacher',
      phone: body.phone || body.phoneNumber || '',
      phoneNumber: body.phoneNumber || body.phone || '',
      subjectCombination: body.subjectCombination || body.subjects || body.subject || '',
      county: body.county || body.currentCounty || '',
      currentCounty: body.currentCounty || body.county || '',
      targetCounty: body.targetCounty || body.desiredCounty || '',
      targetSubCounty: body.targetSubCounty || '',
      currentSchool: body.currentSchool || body.school || '',
      tscNumber: body.tscNumber || '',
      type: body.type || body.category || body.listingCategory || 'TSC Swap',
      category: body.category || body.type || body.listingCategory || 'TSC Swap',
      status: 'pending',
      isApproved: false,
      createdAt: new Date(),
    };

    const newListing = new Listing(listingData);
    const savedListing = await newListing.save();

    return res.status(201).json({
      success: true,
      message: 'Listing created successfully and sent for admin approval.',
      data: formatListing(savedListing),
    });
  } catch (err) {
    console.error('Error creating listing:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =================================================================
// 5. UPDATE LISTING (/api/listings/:id)
// =================================================================
router.put('/:id', async (req, res) => {
  try {
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
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
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
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
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =================================================================
// 6. DELETE LISTING (/api/listings/:id)
// =================================================================
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
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
