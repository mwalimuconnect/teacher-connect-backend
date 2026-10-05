const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

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

    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const nameWithoutExt = path.parse(originalName).name;

    // Streams buffer directly to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // For PDFs, DOCX, and documents
        folder: 'teacher_resources',
        public_id: `${nameWithoutExt}_${Date.now()}${ext}`, // Keeps file extension intact
        use_filename: true,
      },
      (error, result) => {
        // Guard against Cloudinary failure
        if (error || !result) {
          console.error('Cloudinary Error:', error);
          return res.status(500).json({ 
            error: error?.message || 'Failed to store file on Cloudinary.' 
          });
        }

        // Force browser/device download header for document files
        let downloadUrl = result.secure_url;
        if (downloadUrl.includes('/upload/') && !downloadUrl.includes('/fl_attachment/')) {
          downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
        }

        return res.status(200).json({
          success: true,
          fileUrl: downloadUrl,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    console.error('Upload route error:', err);
    return res.status(500).json({ 
      error: err.message || 'Server error uploading file.' 
    });
  }
});

module.exports = router;
