const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from Vercel Environment Variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer memory storage (ideal for Vercel serverless)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file limit
});

// POST /api/upload - Direct File Upload Endpoint
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was provided.' });
    }

    // Streams buffer directly to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // For PDFs, DOCX, and documents
        folder: 'teacher_resources',
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Error:', error);
          return res.status(500).json({ error: 'Failed to store file on Cloudinary.' });
        }
        return res.status(200).json({
          success: true,
          fileUrl: result.secure_url
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    console.error('Upload route error:', err);
    res.status(500).json({ error: err.message || 'Server error uploading file.' });
  }
});

module.exports = router;
