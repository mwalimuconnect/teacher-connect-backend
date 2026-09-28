const express = require('express');
const router = express.Router();
const Resource = require('../models/resource'); // Ensure your Resource model exists in models/resource.js

// Default fallback items if the database has no records yet
const sampleResources = [
  {
    id: '1',
    title: 'Form 4 English Schemes of Work (Term 1-3)',
    category: 'Schemes of Work',
    subject: 'English',
    fileUrl: 'https://example.com/schemes.pdf',
    price: 0
  },
  {
    id: '2',
    title: 'Blossoms of the Savannah Comprehensive Lesson Plan',
    category: 'Lesson Plans',
    subject: 'Literature',
    fileUrl: 'https://example.com/lesson_plan.pdf',
    price: 0
  }
];

// Helper to format resource IDs properly for Flutter
const formatResource = (item) => {
  const doc = item._doc || item;
  return {
    ...doc,
    id: doc._id ? doc._id.toString() : doc.id
  };
};

// GET /api/resources - Fetch all resources or filter by category/search
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category && category.toLowerCase() !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }

    if (search) {
      query.title = { $regex: new RegExp(search, 'i') };
    }

    let resources = await Resource.find(query).sort({ createdAt: -1 });

    // If MongoDB returns no items, return sample fallbacks
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

// GET /api/resources/category/:category - Fetch by category parameter
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

// POST /api/resources - UPLOAD/CREATE A NEW RESOURCE
router.post('/', async (req, res) => {
  try {
    const { title, category, subject, fileUrl, price, description } = req.body;

    if (!title || !category || !fileUrl) {
      return res.status(400).json({ error: 'Title, Category, and File URL are required fields.' });
    }

    const newResource = new Resource({
      title,
      category,
      subject: subject || 'General',
      fileUrl,
      price: price || 0,
      description: description || ''
    });

    await newResource.save();
    return res.status(201).json({
      success: true,
      message: 'Resource uploaded successfully!',
      resource: formatResource(newResource)
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    return res.status(500).json({ error: 'Failed to save resource to database.' });
  }
});

module.exports = router;
