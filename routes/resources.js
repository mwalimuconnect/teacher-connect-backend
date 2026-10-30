const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const axios = require('axios');

// Default fallback items if the database has no records yet
const sampleResources = [
  {
    id: '1',
    title: 'Form 4 English Schemes of Work (Term 1-3)',
    category: 'Schemes of Work',
    subject: 'English',
    form: 'Form 4',
    fileUrl: 'https://example.com/schemes.docx',
    price: 50,
  },
  {
    id: '2',
    title: 'Blossoms of the Savannah Comprehensive Lesson Plan',
    category: 'Lesson Plans',
    subject: 'Literature',
    form: 'Form 3',
    fileUrl: 'https://example.com/lesson_plan.docx',
    price: 50,
  },
];

// Helper to escape special regex characters safely
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// Helper to format resource items properly for Flutter UI
const formatResource = (item) => {
  const doc = item._doc || item;

  // Extract or assign price (defaults to 50 if missing or 0)
  const parsedPrice = parseFloat(doc.price);
  const finalPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 50;

  return {
    ...doc,
    id: doc._id ? doc._id.toString() : doc.id,
    _id: doc._id ? doc._id.toString() : doc.id,
    price: finalPrice,
  };
};

// ============================================================================
// 1. GET /api/resources - Fetch all resources with smart filters
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { category, subject, search, form } = req.query;
    let query = {};

    // Filter by Category
    if (category && category.toLowerCase() !== 'all') {
      const cleanCat = category.trim();
      query.category = { $regex: new RegExp(escapeRegex(cleanCat), 'i') };
    }

    // Filter by Subject (Handles combined subjects like 'English / Literature')
    if (subject && subject.toLowerCase() !== 'all') {
      const cleanSub = subject.trim();
      
      // If subject contains slashes or spaces, break down words or search for exact matches
      const subTokens = cleanSub.split(/[\/\s]+/).filter(Boolean);
      const regexPattern = subTokens.map(escapeRegex).join('|');

      query.subject = { $regex: new RegExp(regexPattern, 'i') };
    }

    // Filter by Search Title
    if (search) {
      query.title = { $regex: new RegExp(escapeRegex(search.trim()), 'i') };
    }

    // Filter by Form
    if (form && form.toLowerCase() !== 'all') {
      query.form = { $regex: new RegExp(escapeRegex(form.trim()), 'i') };
    }

    let resources = await Resource.find(query).sort({ createdAt: -1 });

    if (resources.length === 0 && (!category || category.toLowerCase() === 'all') && !subject && !search) {
      return res.status(200).json(sampleResources.map(formatResource));
    }

    const formatted = resources.map(formatResource);
    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching resources:', error);
    return res.status(500).json({ error: 'Failed to load teacher resources' });
  }
});

// ============================================================================
// 2. GET /api/resources/category/:category - Fetch by category param
// ============================================================================
router.get('/category/:category', async (req, res) => {
  try {
    const catParam = req.params.category;
    let query = {};

    if (catParam && catParam.toLowerCase() !== 'all') {
      query.category = { $regex: new RegExp(escapeRegex(catParam.trim()), 'i') };
    }

    let resources = await Resource.find(query).sort({ createdAt: -1 });
    const formatted = resources.map(formatResource);

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching category resources:', error);
    return res.status(500).json({ error: 'Failed to fetch category resources' });
  }
});

// ============================================================================
// 3. GET /api/resources/download/:id - File Download Proxy (With Direct Fallback)
// ============================================================================
router.get('/download/:id', async (req, res) => {
  try {
    const { isAdmin, preview } = req.query;
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    let fileUrl = resource.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'No file URL attached to this resource' });
    }

    // Check payment & admin authorization
    const isFree = !resource.price || resource.price <= 0;
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;
    const isPaid = resource.isPaid === true;
    const isPreview = preview === 'true' || preview === true;

    if (!isFree && !hasAdminAccess && !isPaid && !isPreview) {
      return res.status(403).json({
        success: false,
        message: 'Payment required to download this resource.',
      });
    }

    // Ensure Cloudinary attachment header for downloads if applicable
    if (!isPreview && fileUrl.includes('cloudinary.com') && !fileUrl.includes('fl_attachment')) {
      fileUrl = fileUrl.replace('/upload/', '/upload/fl_attachment/');
    }

    // OPTION 1: Direct 302 Redirect (Fastest & most stable for serverless platforms like Vercel)
    return res.redirect(302, fileUrl);

  } catch (error) {
    console.error('Error downloading resource:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to download resource: ' + error.message 
      });
    }
  }
});

// ============================================================================
// 4. POST /api/resources - UPLOAD/CREATE A NEW RESOURCE
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { title, category, subject, form, fileUrl, price, description } = req.body;

    if (!title || !category || !fileUrl) {
      return res.status(400).json({ error: 'Title, Category, and File URL are required.' });
    }

    const parsedPrice = parseFloat(price);
    const finalPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 50;

    // Clean up subject name
    const cleanSubject = subject ? subject.trim() : 'General';

    const newResource = new Resource({
      title: title.trim(),
      category: category.trim(),
      subject: cleanSubject,
      form: form || 'General',
      fileUrl,
      price: finalPrice,
      description: description || '',
    });

    await newResource.save();

    return res.status(201).json({
      success: true,
      message: 'Resource uploaded successfully!',
      resource: formatResource(newResource),
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    return res.status(500).json({ error: 'Failed to save resource to database.' });
  }
});

// ============================================================================
// 5. PUT /api/resources/:id - UPDATE AN EXISTING RESOURCE (ADMIN ONLY)
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { isAdmin } = req.query;
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;
    
    if (!hasAdminAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can edit resources.',
      });
    }

    const { title, category, subject, form, fileUrl, price, description } = req.body;

    const updatedResource = await Resource.findByIdAndUpdate(
      req.params.id,
      { title, category, subject, form, fileUrl, price, description },
      { new: true, runValidators: true }
    );

    if (!updatedResource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Resource updated successfully!',
      resource: formatResource(updatedResource),
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    return res.status(500).json({ success: false, message: 'Failed to update resource.' });
  }
});

// ============================================================================
// 6. DELETE /api/resources/:id - DELETE AN UNWANTED RESOURCE (ADMIN ONLY)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { isAdmin } = req.query;
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;
    
    if (!hasAdminAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can delete resources.',
      });
    }

    const resourceId = req.params.id;
    const deletedResource = await Resource.findByIdAndDelete(resourceId);

    if (!deletedResource) {
      return res.status(404).json({ success: false, message: 'Resource not found in database.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Resource deleted successfully by admin!',
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete resource.' });
  }
});

module.exports = router;
