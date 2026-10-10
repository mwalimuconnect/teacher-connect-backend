const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// =========================================================
// HELPER: Format listing data consistently for Flutter UI
// =========================================================
const formatListing = (item) => {
  if (!item) return null;

  const doc = item._doc || item;

  // Extract populated user object safely (handles 'user' or 'userId' schema references)
  const userObj =
    doc.user && typeof doc.user === 'object'
      ? doc.user
      : doc.userId && typeof doc.userId === 'object'
      ? doc.userId
      : {};

  // 1. Phone Number Extraction (Checks direct fields then populated user)
  const phoneVal =
    doc.phone ||
    doc.contactPhone ||
    doc.phoneNumber ||
    userObj.phone ||
    userObj.contactPhone ||
    userObj.phoneNumber ||
    '';

  // 2. School Name Extraction (Checks direct fields then populated user)
  const schoolVal =
    doc.schoolName ||
    doc.currentSchool ||
    doc.school ||
    userObj.schoolName ||
    userObj.currentSchool ||
    userObj.school ||
    '';

  // 3. Teacher Name Extraction (Checks direct fields then populated user)
  const nameVal =
    doc.teacherName ||
    doc.fullName ||
    doc.userName ||
    doc.name ||
    userObj.fullName ||
    userObj.teacherName ||
    userObj.name ||
    '';

    // 4. Safe TSC Number Extraction
  // Extract all possible values into an array
  const candidates = [
    userObj.tscNumber,
    userObj.tscNo,
    userObj.tsc,
    userObj.tsc_number,
    userObj.tsc_no,
    doc.tscNumber,
    doc.tscNo,
    doc.tsc,
    doc.tsc_number,
    doc.tsc_no,
    item.tscNumber,
    item.tscNo,
  ];

  // Filter out null, undefined, empty strings, "N/A", "null", and "undefined"
  const validTsc = candidates.find((val) => {
    if (val === null || val === undefined) return false;
    const str = String(val).trim();
    return (
      str.length > 0 &&
      str.toUpperCase() !== 'N/A' &&
      str.toUpperCase() !== 'NULL' &&
      str.toUpperCase() !== 'UNDEFINED'
    );
  });

  const displayTsc = validTsc ? String(validTsc).trim() : 'N/A';

  // 5. Subject & Location Fallbacks
  const subjectsVal =
    doc.subjectCombination ||
    doc.subjects ||
    doc.subject ||
    userObj.subjectCombination ||
    userObj.subjects ||
    userObj.subject ||
    '';

  let targetVal = doc.targetLocation || '';
  if (!targetVal) {
    if (doc.targetCounty && doc.targetSubCounty) {
      targetVal = `${doc.targetCounty} (${doc.targetSubCounty})`;
    } else if (doc.targetCounty) {
      targetVal = doc.targetCounty;
    } else if (doc.targetSubCounty) {
      targetVal = doc.targetSubCounty;
    }
  }

  const categoryType = doc.type || doc.category || 'TSC Swap';
  const approvedStatus =
    doc.isApproved === true || doc.status === 'approved';

  return {
    ...doc,
    _id: String(doc._id || doc.id || ''),
    id: String(doc._id || doc.id || ''),
    teacherName: nameVal,
    fullName: nameVal,
    phone: phoneVal,
    phoneNumber: phoneVal,
    contactPhone: phoneVal,
    tscNumber: displayTsc,
    tscNo: displayTsc,
    tsc: displayTsc,
    isTscCompliant:
      doc.isTscCompliant === true ||
      doc.tscCompliant === true ||
      displayTsc !== 'N/A',
    currentSchool: schoolVal,
    school: schoolVal,
    schoolName: schoolVal,
    subjectCombination: subjectsVal,
    subjects: subjectsVal,
    subject: subjectsVal,
    targetLocation: targetVal,
    targetCounty: doc.targetCounty || targetVal,
    county: doc.county || doc.currentCounty || doc.currentLocation || 'N/A',
    currentCounty: doc.currentCounty || doc.county || doc.currentLocation || 'N/A',
    salary: doc.salary || '',
    type: categoryType,
    category: categoryType,
    isPaid: doc.isPaid === true,
    isApproved: approvedStatus,
    status: approvedStatus ? 'approved' : doc.status || 'pending',
    user: {
      name: nameVal,
      phone: phoneVal,
      school: schoolVal,
      tscNumber: displayTsc,
    },
  };
};

// =========================================================
// 1. GET ALL LISTINGS (WITH PAGINATION, CATEGORY FILTER, ADMIN BYPASS)
// =========================================================
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    const isAdmin = req.query.isAdmin === 'true';

    let filter = {};

    // Apply approval filter unless client is admin
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

    // Populate user references so user profile TSC numbers & school details are retrieved
    const listings = await Listing.find(filter)
      .populate('user', 'fullName name phone tscNumber tscNo tsc school currentSchool')
      .populate('userId', 'fullName name phone tscNumber tscNo tsc school currentSchool')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalDocs = await Listing.countDocuments(filter);
    const formatted = listings.map(formatListing);

    return res.status(200).json({
      data: formatted,
      pagination: {
        total: totalDocs,
        page,
        pages: Math.ceil(totalDocs / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching listings:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server Error' });
  }
});

// =========================================================
// 2. GET LISTINGS BY TAB TYPE (/api/listings/type/:type)
// =========================================================
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

    const listings = await Listing.find(typeQuery)
      .populate('user', 'fullName name phone tscNumber tscNo tsc school currentSchool')
      .populate('userId', 'fullName name phone tscNumber tscNo tsc school currentSchool')
      .sort({ createdAt: -1 });

    const formatted = listings.map(formatListing);
    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server Error' });
  }
});

// =========================================================
// 3. GET SINGLE LISTING BY ID (/api/listings/:id)
// =========================================================
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('user', 'fullName name phone tscNumber tscNo tsc school currentSchool')
      .populate('userId', 'fullName name phone tscNumber tscNo tsc school currentSchool');

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    return res.status(200).json(formatListing(listing));
  } catch (err) {
    console.error('Error fetching listing:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server Error' });
  }
});

// =========================================================
// 4. CREATE NEW LISTING (/api/listings)
// =========================================================
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const tscCaptured =
      body.tscNumber || body.tscNo || body.tsc || body.tsc_number || '';

    const listingData = {
      ...body,
      fullName: body.fullName || body.teacherName || 'Teacher',
      teacherName: body.teacherName || body.fullName || 'Teacher',
      phone: body.phone || body.contactPhone || body.phoneNumber || '',
      phoneNumber: body.phoneNumber || body.phone || body.contactPhone || '',
      contactPhone: body.contactPhone || body.phone || body.phoneNumber || '',
      subjectCombination: body.subjectCombination || body.subject || body.subjects || '',
      subject: body.subject || body.subjectCombination || body.subjects || '',
      subjects: body.subjects || body.subjectCombination || body.subject || '',
      county: body.county || body.currentCounty || body.currentLocation || '',
      currentCounty: body.currentCounty || body.county || body.currentLocation || '',
      currentLocation: body.currentLocation || body.currentCounty || body.county || '',
      targetCounty: body.targetCounty || body.desiredCounty || '',
      targetSubCounty: body.targetSubCounty || '',
      currentSchool: body.currentSchool || body.schoolName || body.school || '',
      schoolName: body.schoolName || body.currentSchool || body.school || '',
      tscNumber: tscCaptured,
      tscNo: tscCaptured,
      tsc: tscCaptured,
      salary: body.salary || '',
      isTscCompliant:
        body.isTscCompliant === true ||
        body.tscCompliant === true ||
        (tscCaptured !== '' && tscCaptured !== 'N/A'),
      type: body.type || body.category || body.listingCategory || 'TSC Swap',
      category: body.category || body.type || body.listingCategory || 'TSC Swap',
      status: 'pending',
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
    return res.status(500).json({ success: false, error: err.message || 'Server Error' });
  }
});

// =========================================================
// 5. UPDATE LISTING (/api/listings/:id)
// =========================================================
const handleUpdate = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.status === 'approved' || updateData.isApproved === true) {
      updateData.status = 'approved';
      updateData.isApproved = true;
    }

    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: false }
    )
      .populate('user', 'fullName name phone tscNumber tscNo tsc school currentSchool')
      .populate('userId', 'fullName name phone tscNumber tscNo tsc school currentSchool');

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
    return res.status(500).json({ success: false, error: err.message || 'Server Error' });
  }
};

router.put('/:id', handleUpdate);
router.patch('/:id', handleUpdate);

// =========================================================
// 6. DELETE LISTING (/api/listings/:id)
// =========================================================
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
    return res.status(500).json({ success: false, error: err.message || 'Server Error' });
  }
});

// =========================================================
// 7. ENHANCED MIGRATION ROUTE: Sync TSC numbers via User ID or Phone Match
// =========================================================
router.get('/admin/sync-tsc', async (req, res) => {
  try {
    const User = require('../models/User');

    // Fetch ALL listings to perform thorough validation
    const listings = await Listing.find({});
    let updatedCount = 0;

    for (const listing of listings) {
      // Extract raw listing TSC value
      const rawTsc = (listing.tscNumber || listing.tscNo || listing.tsc || '').toString().trim();
      
      // Check if current listing lacks a valid numeric/alphanumeric TSC
      const isCurrentTscInvalid =
        rawTsc === '' ||
        rawTsc.toUpperCase() === 'N/A' ||
        rawTsc.toUpperCase() === 'NULL' ||
        rawTsc.toUpperCase() === 'UNDEFINED';

      if (isCurrentTscInvalid) {
        let userDoc = null;

        // 1. Try finding user by MongoDB Object Reference
        const userId = listing.user || listing.userId;
        if (userId) {
          try {
            userDoc = await User.findById(userId);
          } catch (e) {
            // Ignore invalid ObjectId cast errors
          }
        }

        // 2. Fallback: Try matching by Phone Number if User ID wasn't linked
        if (!userDoc) {
          const phone = (listing.phone || listing.contactPhone || listing.phoneNumber || '').toString().trim();
          if (phone) {
            userDoc = await User.findOne({
              $or: [
                { phone: phone },
                { phoneNumber: phone },
                { contactPhone: phone }
              ]
            });
          }
        }

        // 3. If User found, extract valid TSC number
        if (userDoc) {
          const foundTsc = (userDoc.tscNumber || userDoc.tscNo || userDoc.tsc || '').toString().trim();
          
          if (
            foundTsc &&
            foundTsc.toUpperCase() !== 'N/A' &&
            foundTsc.toUpperCase() !== 'NULL' &&
            foundTsc.toUpperCase() !== 'UNDEFINED'
          ) {
            listing.tscNumber = foundTsc;
            listing.tscNo = foundTsc;
            listing.tsc = foundTsc;
            listing.isTscCompliant = true;

            // Link user ID if missing
            if (!listing.user) listing.user = userDoc._id;
            if (!listing.userId) listing.userId = userDoc._id;

            await listing.save();
            updatedCount++;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${updatedCount} listings using User IDs and Phone matching!`,
    });
  } catch (err) {
    console.error('Migration error:', err);
    return res
      .status(500)
      .json({ success: false, error: err.message || 'Migration failed' });
  }
});
            
module.exports = router;
