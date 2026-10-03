const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    tscNumber: { type: String, default: '', trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    nationalId: { type: String, default: '', trim: true },
    role: { type: String, default: 'Member Teacher' },
    password: { type: String, required: true },
    status: { type: String, default: 'pending' },
    isApproved: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
