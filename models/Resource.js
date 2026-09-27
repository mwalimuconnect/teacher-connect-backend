const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true }, // 'Schemes of Work', 'Lesson Plans', etc.
  subject: { type: String },
  form: { type: String },
  fileUrl: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Resource', resourceSchema);
