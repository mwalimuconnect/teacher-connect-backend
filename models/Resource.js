const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true }, // 'Schemes of Work', 'Lesson Plans', etc.
  subject: { type: String, default: 'General' },
  fileUrl: { type: String, required: true },  // Link from Firebase, Cloudinary, or AWS S3
  price: { type: Number, default: 0 },
  description: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Resource', resourceSchema);
