const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');

// ============================================================================
// 1. GET /api/resources - Fetch all resources with filters (subject, category, search)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { subject, category, search } = req.query;
    let query = {};

    const resourceSubject = Array.isArray(subject) ? subject[0] : subject;
    if (resourceSubject && typeof resourceSubject === 'string' && resourceSubject.toLowerCase() !== 'all') {
      query.subject = { $regex: new RegExp(resourceSubject.trim(), 'i') };
    }

    const resourceCategory = Array.isArray(category) ? category[0] : category;
    if (resourceCategory && typeof resourceCategory === 'string' && resourceCategory.toLowerCase() !== 'all') {
      query.category = { $regex: new RegExp(resourceCategory.trim(), 'i') };
    }

    const searchQuery = Array.isArray(search) ? search[0] : search;
    if (searchQuery && typeof searchQuery === 'string') {
      const cleanSearch = searchQuery.trim();
      if (cleanSearch.length > 0) {
        query.$or = [
          { title: { $regex: new RegExp(cleanSearch, 'i') } },
          { description: { $regex: new RegExp(cleanSearch, 'i') } },
          { subject: { $regex: new RegExp(cleanSearch, 'i') } },
        ];
      }
    }

    const resources = await Resource.find(query).sort({ createdAt: -1 });
    return res.status(200).json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    return res.status(500).json({ success: false, message: 'Failed to load resources.' });
  }
});

// ============================================================================
// 2. GET /api/resources/:id - Fetch single resource details (WITH OWNERSHIP CHECK)
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { isAdmin, userId, preview } = req.query;
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    const isOwner = userId && (
      (resource.userId && String(resource.userId) === String(userId)) ||
      (resource.user && String(resource.user) === String(userId))
    );

    const isFree = !resource.price || resource.price <= 0;
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;
    const isPaid = resource.isPaid === true;
    const isPreview = preview === 'true' || preview === true;

    if (!isFree && !hasAdminAccess && !isPaid && !isPreview && !isOwner) {
      return res.status(403).json({
        success: false,
        requiresPayment: true,
        message: 'Payment required to view full resource details.',
      });
    }

    return res.status(200).json({
      success: true,
      resource,
    });
  } catch (error) {
    console.error('Error fetching resource details:', error);
    return res.status(500).json({ success: false, message: 'Server error loading resource details.' });
  }
});

// ============================================================================
// 3. POST /api/resources - Create/Upload a new resource
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { title, category, subject, form, fileUrl, price, description, userId, userName } = req.body;

    if (!title || !fileUrl) {
      return res.status(400).json({ success: false, message: 'Title and file URL are required.' });
    }

    const newResource = new Resource({
      title: title.trim(),
      category: category ? category.trim() : 'Notes',
      subject: subject ? subject.trim() : 'General',
      form: form ? form.trim() : 'General',
      fileUrl: fileUrl.trim(),
      price: price !== undefined ? price : 50,
      description: description || '',
      userId: userId || null,
      userName: userName || '',
    });

    await newResource.save();

    return res.status(201).json({
      success: true,
      message: 'Resource uploaded successfully!',
      resource: newResource,
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload resource.' });
  }
});

// ============================================================================
// 4. PUT /api/resources/:id - Update an existing resource (Owner or Admin)
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { isAdmin, userId } = req.query;
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    const isOwner = userId && resource.userId && String(resource.userId) === String(userId);
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;

    if (!isOwner && !hasAdminAccess) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this resource.' });
    }

    const updated = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });

    return res.status(200).json({
      success: true,
      message: 'Resource updated successfully!',
      resource: updated,
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    return res.status(500).json({ success: false, message: 'Failed to update resource.' });
  }
});

// ============================================================================
// 5. DELETE /api/resources/:id - Delete a resource (Owner or Admin)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { isAdmin, userId } = req.query;
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    const isOwner = userId && resource.userId && String(resource.userId) === String(userId);
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;

    if (!isOwner && !hasAdminAccess) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this resource.' });
    }

    await Resource.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Resource deleted successfully!',
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete resource.' });
  }
});

module.exports = router;
