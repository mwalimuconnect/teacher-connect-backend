const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Configure Cloudinary from Vercel Environment Variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.API_SECRET || process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer memory storage (ideal for Vercel serverless environment)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // Increased to 25MB for large study notes & zip files
});

// POST /api/upload - Direct File Upload Endpoint
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was provided.' });
    }

    // Validate Cloudinary configuration exists
    if (!cloudinary.config().cloud_name || !cloudinary.config().api_key) {
      console.error('Cloudinary configuration is missing environment variables.');
      return res.status(500).json({ error: 'Server storage configuration error.' });
    }

    const originalName = req.file.originalname;
    const nameWithoutExt = path.parse(originalName).name.replace(/[^a-zA-Z0-9]/g, '_');

    // Stream buffer directly to Cloudinary using 'auto' resource type 
    // This safely handles PDFs, Word docs, Excel sheets, and Zips without breaking links
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto', // 👈 'auto' lets Cloudinary properly manage and deliver all document types
        folder: 'teacher_connect_resources',
        public_id: `${nameWithoutExt}_${Date.now()}`,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        // Guard against Cloudinary failure
        if (error || !result) {
          console.error('Cloudinary Error:', error);
          return res.status(500).json({
            error: error?.message || 'Failed to store file on Cloudinary.',
          });
        }

        return res.status(200).json({
          success: true,
          fileUrl: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    console.error('Upload route error:', err);
    return res.status(500).json({
      error: err.message || 'Server error uploading file.',
    });
  }
});

module.exports = router;
