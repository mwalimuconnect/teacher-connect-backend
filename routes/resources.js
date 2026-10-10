const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const axios = require('axios');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Multer for in-memory file handling
const upload = multer({ storage: multer.memoryStorage() });

// Configure Cloudinary (Make sure your environment variables are set in Vercel/Render)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'lxxyqoqa',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

// Helper to format resource items properly for Flutter UI
const formatResource = (item) => {
  const doc = item._doc || item;

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
// 1. GET /api/resources - Fetch all resources or filter by category
// ============================================================================
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

    if (resources.length === 0 && (!category || category.toLowerCase() === 'all') && !search) {
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

// ============================================================================
// 3. GET /api/resources/download/:id - File Download Proxy (With ZIP Support)
// ============================================================================
router.get('/download/:id', async (req, res) => {
  try {
    const { isAdmin } = req.query;
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    const fileUrl = resource.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'No file URL attached to this resource' });
    }

    const isFree = !resource.price || resource.price <= 0;
    const hasAdminAccess = isAdmin === 'true' || isAdmin === true;
    const isPaid = resource.isPaid === true;

    if (!isFree && !hasAdminAccess && !isPaid) {
      return res.status(403).json({
        success: false,
        message: 'Payment required to download this resource.',
      });
    }

    let extension = '.docx';
    if (fileUrl.includes('.zip')) extension = '.zip';
    else if (fileUrl.includes('.xlsx')) extension = '.xlsx';
    else if (fileUrl.includes('.pdf')) extension = '.pdf';
    else if (fileUrl.includes('.ppt') || fileUrl.includes('.pptx')) extension = '.pptx';

    const safeFilename = resource.title.replace(/[^a-zA-Z0-9_\-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}${extension}"`);
    
    if (extension === '.zip') {
      res.setHeader('Content-Type', 'application/zip');
    } else if (extension === '.docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } else if (extension === '.xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else if (extension === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (extension === '.pptx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    }

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

// ============================================================================
// 4. POST /api/upload - Receive file from Flutter and upload to Cloudinary
// ============================================================================
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided in the request.' });
    }

    // Convert buffer to data URI for Cloudinary
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const uploadResult = await cloudinary.uploader.upload(fileBase64, {
      resource_type: 'auto', // Handles PDF, DOCX, ZIP, and images automatically
      folder: 'teacher_resources',
    });

    return res.status(200).json({
      success: true,
      url: uploadResult.secure_url,
    });
  } catch (error) {
    console.error('Cloudinary server upload error:', error);
    return res.status(500).json({ error: 'Failed to upload file to Cloudinary: ' + error.message });
  }
});

// ============================================================================
// 5. POST /api/resources - UPLOAD/CREATE A NEW RESOURCE RECORD
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { title, category, subject, form, fileUrl, price, description } = req.body;

    if (!title || !category || !fileUrl) {
      return res.status(400).json({ error: 'Title, Category, and File URL are required.' });
    }

    const parsedPrice = parseFloat(price);
    const finalPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 50;

    const newResource = new Resource({
      title,
      category,
      subject: subject || 'General',
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

module.exports = router;
