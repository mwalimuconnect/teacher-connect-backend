const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    tscNumber: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nationalId: {
      type: String,
      default: '',
      trim: true,
    },
    currentSchool: {
      type: String,
      default: '',
      trim: true,
    },
    county: {
      type: String,
      default: '',
      trim: true,
    },
    subCounty: {
      type: String,
      default: '',
      trim: true,
    },
    subjectCombination: {
      type: String,
      default: '',
      trim: true,
    },
    subjects: {
      type: String,
      default: '',
      trim: true,
    },
    profilePhotoUrl: {
      type: String,
      default: '',
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      default: 'Member Teacher',
    },
    password: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    canEditTsc: {
      type: Boolean,
      default: false,
    },
    canUploadResources: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('User', userSchema);
