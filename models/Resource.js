const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true }, // 'Schemes of Work', 'Lesson Plans', etc.
  subject: { type: String, default: 'General' },
  form: { type: String, default: 'General' }, // Added to capture Form 1-4 selection
  fileUrl: { type: String, required: true }, // Link from Cloudinary
  price: { type: Number, default: 50 }, // Set minimum valid price to 50
  description: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Resource', resourceSchema);
