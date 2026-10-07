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
    price: 0,
  },
  {
    id: '2',
    title: 'Blossoms of the Savannah Comprehensive Lesson Plan',
    category: 'Lesson Plans',
    subject: 'Literature',
    form: 'Form 3',
    fileUrl: 'https://example.com/lesson_plan.docx',
    price: 0,
  },
];

// Helper to format resource IDs properly for Flutter
const formatResource = (item) => {
  const doc = item._doc || item;
  return {
    ...doc,
    id: doc._id ? doc._id.toString() : doc.id,
  };
};

// =========================================================================
// 1. GET /api/resources - Fetch all resources or filter by category/search
// =========================================================================
router.get('/', async (req, res) => {
  try {
    const { category, search, form } = req.query;
    let query = {};

    if (category && category.toLowerCase() !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }

    if (search) {
      query.title = { $regex: new RegExp(search, 'i') };
    }

    if (form && form.toLowerCase() !== 'all') {
      query.form = { $regex: new RegExp(form, 'i') };
    }

    let resources = await Resource.find(query).sort({ createdAt: -1 });

    // If MongoDB returns no items and no search/category filter was passed, return sample fallbacks
    if (resources.length === 0 && !search && (!category || category.toLowerCase() === 'all')) {
      return res.status(200).json(sampleResources);
    }

    const formatted = resources.map(formatResource);
    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching resources:', error);
    return res.status(500).json({ error: 'Failed to load teacher resources' });
  }
});

// =========================================================================
// 2. GET /api/resources/category/:category - Fetch by category parameter
// =========================================================================
router.get('/category/:category', async (req, res) => {
  try {
    const catParam = req.params.category;
    let query = {};

    if (catParam && catParam.toLowerCase() !== 'all') {
      query.category = { $regex: new RegExp(catParam, 'i') };
    }

    let resources = await Resource.find(query).sort({ createdAt: -1 });
    const formatted = resources.map(formatResource);

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching category resources:', error);
    return res.status(500).json({ error: 'Failed to fetch category resources' });
  }
});

// =========================================================================
// 3. GET /api/resources/download/:id - File Download Proxy with Correct Headers
// =========================================================================
router.get('/download/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    const fileUrl = resource.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'No file URL associated with this resource' });
    }

    // Detect file extension or default to .docx
    let extension = '.docx';
    if (fileUrl.includes('.xlsx')) extension = '.xlsx';
    if (fileUrl.includes('.pdf')) extension = '.pdf';
    if (fileUrl.includes('.ppt') || fileUrl.includes('.pptx')) extension = '.pptx';

    const safeFilename = resource.title.replace(/[^a-zA-Z0-9_\-]/g, '_') + extension;

    // Set binary content-disposition and mime headers
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    if (extension === '.docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } else if (extension === '.xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else if (extension === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    }

    // Stream the binary document directly through Express rather than redirecting
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('Error downloading resource:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
});

// =========================================================================
// 4. POST /api/resources - UPLOAD/CREATE A NEW RESOURCE
// =========================================================================
router.post('/', async (req, res) => {
  try {
    const { title, category, subject, form, fileUrl, price, description } = req.body;

    if (!title || !category || !fileUrl) {
      return res.status(400).json({ error: 'Title, Category, and File URL are required.' });
    }

    const newResource = new Resource({
      title,
      category,
      subject: subject || 'General',
      form: form || 'General',
      fileUrl,
      price: price !== undefined ? price : 0,
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

module.exports = router;
