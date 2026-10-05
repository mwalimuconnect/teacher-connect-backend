const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing'); // Fixed case-sensitivity for Vercel/Linux

// Helper to format listing data consistently
const formatListing = (item) => {
  const doc = item._doc || item;

  const phoneVal = item.phone || item.contactPhone || item.phoneNumber || '';
  const schoolVal = item.currentSchool || item.school || item.schoolName || '';
  const nameVal = item.fullName || item.teacherName || 'N/A';

  // Extract Subject Combination properly from Listing schema
  const subjectsVal = item.subjectCombination || item.subjects || item.subject || 'N/A';

  // Format Target Location string nicely
  let targetVal = '';
  if (item.targetCounty && item.targetSubCounty) {
    targetVal = `${item.targetCounty} (${item.targetSubCounty})`;
  } else if (item.targetCounty) {
    targetVal = item.targetCounty;
  } else if (item.targetSubCounty) {
    targetVal = item.targetSubCounty;
  }

  return {
    ...doc,
    teacherName: nameVal,
    fullName: nameVal,
    phone: phoneVal,
    phoneNumber: phoneVal,
    contactNumber: phoneVal,
    currentSchool: schoolVal,
    school: schoolVal,
    subjectCombination: subjectsVal,
    subjects: subjectsVal,
    targetLocation: targetVal,
    user: {
      name: nameVal,
      phone: phoneVal,
      school: schoolVal,
    },
    currentCounty: item.county || item.currentCounty || 'N/A',
  };
};

// =========================================================================
// 1. GET ALL LISTINGS OR FILTER BY QUERY STRING (?type=...)
// =========================================================================
router.get('/', async (req, res) => {
  try {
    const filter = {};
    const queryType = req.query.type;

    if (queryType) {
      if (/swap/i.test(queryType)) {
        filter.type = 'TSC Swap';
      } else if ((/vacancy/i.test(queryType) || /job/i.test(queryType)) && !/seeker/i.test(queryType)) {
        filter.type = 'BOM Vacancy';
      } else if (/seeker/i.test(queryType) || /seeking/i.test(queryType)) {
        filter.type = 'Seeking BOM Job';
      } else {
        filter.type = new RegExp(queryType, 'i');
      }
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// =========================================================================
// 2. GET LISTINGS BY TAB TYPE (/api/listings/type/:type)
// =========================================================================
router.get('/type/:type', async (req, res) => {
  try {
    const requestedType = req.params.type;
    let typeQuery = {};

    if (/swap/i.test(requestedType)) {
      typeQuery = { type: 'TSC Swap' };
    } else if (/seeker/i.test(requestedType) || /seeking/i.test(requestedType)) {
      typeQuery = { type: 'Seeking BOM Job' };
    } else if (/vacancy/i.test(requestedType) || /job/i.test(requestedType)) {
      typeQuery = { type: 'BOM Vacancy' };
    } else {
      typeQuery = { type: new RegExp(requestedType, 'i') };
    }

    const listings = await Listing.find(typeQuery).sort({ createdAt: -1 });
    const formatted = listings.map(formatListing);

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch listings' });
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
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 4. CREATE NEW LISTING (/api/listings)
// =========================================================================
router.post('/', async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    const savedListing = await newListing.save();
    return res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: formatListing(savedListing),
    });
  } catch (err) {
    console.error('Error creating listing:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 5. UPDATE LISTING (/api/listings/:id) - FIXES THE 404 ERROR
// =========================================================================
router.put('/:id', async (req, res) => {
  try {
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
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

// Support PATCH requests as well for updates
router.patch('/:id', async (req, res) => {
  try {
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
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
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
