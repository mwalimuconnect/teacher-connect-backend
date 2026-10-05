const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const os = require('os'); // Added os module

// Configure temporary storage in Vercel's writable /tmp directory
const upload = multer({ dest: os.tmpdir() });

// Configure Cloudinary credentials (ensure these environment variables are in Vercel / .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /api/upload - Upload resource document
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName); // Extract extension e.g., .docx or .pdf
    const nameWithoutExt = path.parse(originalName).name;

    // Upload to Cloudinary with extension preserved
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'raw', // Critical for non-image binary files (.docx, .pdf, .xlsx)
      public_id: `teacher_resources/${nameWithoutExt}_${Date.now()}${ext}`,
      use_filename: true,
      unique_filename: false,
    });

    // Remove temporary file from /tmp
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Insert fl_attachment into the URL to guarantee proper file attachment headers
    let downloadUrl = result.secure_url;
    if (downloadUrl.includes('/upload/') && !downloadUrl.includes('/fl_attachment/')) {
      downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
    }

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      url: downloadUrl,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Server error during file upload.',
    });
  }
});

module.exports = router;
