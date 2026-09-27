const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');

// Helper function to format items uniformly
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

// GET /api/listings - Fetch all listings or filter by query
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) {
      filter.type = { $regex: new RegExp(req.query.type, 'i') };
    }

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    const formattedListings = listings.map(formatListing);

    // Return direct array for Flutter list parser compatibility
    res.status(200).json(formattedListings);
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings' });
  }
});

// GET /api/listings/type/:type - Fetch listings by tab category
router.get('/type/:type', async (req, res) => {
  try {
    const requestedType = req.params.type;
    let typeQuery = {};

    if (/swap/i.test(requestedType)) {
      typeQuery = { type: { $regex: /swap/i } };
    } else if (/job|vacancy/i.test(requestedType)) {
      typeQuery = { type: { $regex: /job|vacancy/i } };
    } else if (/seeking|seeker/i.test(requestedType)) {
      typeQuery = { type: { $regex: /seeking|seeker/i } };
    } else {
      typeQuery = { type: { $regex: new RegExp(requestedType, 'i') } };
    }

    const listings = await Listing.find(typeQuery).sort({ createdAt: -1 });
    const formattedListings = listings.map(formatListing);

    // Return direct array for Flutter list parser compatibility
    res.status(200).json(formattedListings);
  } catch (err) {
    console.error('Error fetching listings by type:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch listings by type' });
  }
});

// POST /api/listings - Handle listing submissions safely
router.post('/', async (req, res) => {
  try {
    const {
      type,
      fullName,
      teacherName,
      county,
      currentCounty,
      subCounty,
      currentSchool,
      school,
      subjectCombination,
      subject,
      phone,
      contactPhone,
      phoneNumber,
      contactNumber,
      targetCounty,
      targetSubCounty,
      status
    } = req.body;

    const listingData = {
      type: type || 'TSC Swap',
      fullName: fullName || teacherName || 'Anonymous Teacher',
      county: county || currentCounty || 'Unspecified',
      subCounty: subCounty || 'Not Specified',
      currentSchool: currentSchool || school || 'Not Specified',
      subjectCombination: subjectCombination || subject || 'Not Specified',
      phone: phone || contactPhone || phoneNumber || contactNumber || '',
      targetCounty: targetCounty || '',
      targetSubCounty: targetSubCounty || '',
      status: status || 'Pending'
    };

    const newListing = new Listing(listingData);
    const savedListing = await newListing.save();

    res.status(201).json({
      message: 'Listing created successfully',
      data: savedListing
    });
  } catch (err) {
    console.error('Error saving listing:', err);
    res.status(400).json({ error: err.message || 'Failed to create listing' });
  }
});

// PUT /api/listings/:id - Update an existing listing
router.put('/:id', async (req, res) => {
  try {
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedListing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Listing updated successfully',
      data: updatedListing
    });
  } catch (err) {
    console.error('Error updating listing:', err);
    res.status(500).json({ error: err.message || 'Failed to update listing' });
  }
});

// DELETE /api/listings/:id - Delete a listing
router.delete('/:id', async (req, res) => {
  try {
    const deletedListing = await Listing.findByIdAndDelete(req.params.id);

    if (!deletedListing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting listing:', err);
    res.status(500).json({ error: err.message || 'Failed to delete listing' });
  }
});

module.exports = router;
