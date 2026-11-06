const mongoose = require('mongoose');

const ResourceRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  tscNumber: { type: String, default: 'N/A' },
  phone: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ResourceRequest || mongoose.model('ResourceRequest', ResourceRequestSchema);
