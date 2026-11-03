const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing'); // Assuming your model is named Listing

// ============================================================================
// 1. GET /api/listings - Fetch all listings with filters (category, location, search)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { type, location, subject, search } = req.query;
    let query = {};

    // Filter by Listing Type / Category (e.g., TSC Swaps, BOM Jobs, Seeking BOM)
    if (type && type.toLowerCase() !== 'all') {
      query.type = { $regex: new RegExp(type.trim(), 'i') };
    }

    // Filter by Location / County / Sub-county
    if (location && location.toLowerCase() !== 'all') {
      query.location = { $regex: new RegExp(location.trim(), 'i') };
    }

    // Filter by Subject
    if (subject && subject.toLowerCase() !== 'all') {
      query.subject = { $regex: new RegExp(subject.trim(), 'i') };
    }

    // Search query
    if (search) {
      query.$or = [
        { title: { $regex: new RegExp(search.trim(), 'i') } },
        { description: { $regex: new RegExp(search.trim(), 'i') } },
        { location: { $regex: new RegExp(search.trim(), 'i') } },
      ];
    }

    const listings = await Listing.find(query).sort({ createdAt: -1 });
    return res.status(200).json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    return res.status(500).json({ success: false, message: 'Failed to load listings.' });
  }
});

// ============================================================================
// 2. GET /api/listings/:id - Fetch single listing details (WITH OWNERSHIP CHECK)
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { isAdmin, userId, preview } = req.query;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found.' });
    }

    // 🔑 Check if the requesting user is the original creator/owner of this post
    const isOwner = userId && (
      (listing.userId && String(listing.userId) === String(userId)) ||
      (listing.user && String(listing.user) === String(userId))
    );

    // Authorization checks
    const isFree = !listing.price || listing.price <= 0;
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;
    const isPaid = listing.isPaid === true;
    const isPreview = preview === 'true' || preview === true;

    // If not free, admin, paid, preview, OR owner, block with payment prompt
    if (!isFree && !hasAdminAccess && !isPaid && !isPreview && !isOwner) {
      return res.status(403).json({
        success: false,
        requiresPayment: true,
        message: 'Payment required to view full details.',
      });
    }

    return res.status(200).json({
      success: true,
      listing,
    });
  } catch (error) {
    console.error('Error fetching listing details:', error);
    return res.status(500).json({ success: false, message: 'Server error loading listing details.' });
  }
});

// ============================================================================
// 3. POST /api/listings - Create a new post/listing (Saves userId)
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { title, type, location, subject, description, price, userId, contacts } = req.body;

    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'Title and listing type are required.' });
    }

    const newListing = new Listing({
      title: title.trim(),
      type: type.trim(),
      location: location ? location.trim() : 'General',
      subject: subject ? subject.trim() : 'General',
      description: description || '',
      price: price || 0,
      userId: userId || null, // 👈 Saves owner ID so they can view their post for free
      contacts: contacts || '',
    });

    await newListing.save();

    return res.status(201).json({
      success: true,
      message: 'Listing posted successfully!',
      listing: newListing,
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    return res.status(500).json({ success: false, message: 'Failed to create listing.' });
  }
});

// ============================================================================
// 4. PUT /api/listings/:id - Update an existing listing (Owner or Admin)
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { isAdmin, userId } = req.query;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found.' });
    }

    const isOwner = userId && listing.userId && String(listing.userId) === String(userId);
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;

    if (!isOwner && !hasAdminAccess) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this listing.' });
    }

    const updated = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Listing updated successfully!',
      listing: updated,
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    return res.status(500).json({ success: false, message: 'Failed to update listing.' });
  }
});

// ============================================================================
// 5. DELETE /api/listings/:id - Delete a listing (Owner or Admin)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { isAdmin, userId } = req.query;
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found.' });
    }

    const isOwner = userId && listing.userId && String(listing.userId) === String(userId);
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;

    if (!isOwner && !hasAdminAccess) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this listing.' });
    }

    await Listing.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Listing deleted successfully!',
    });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete listing.' });
  }
});

module.exports = router;
