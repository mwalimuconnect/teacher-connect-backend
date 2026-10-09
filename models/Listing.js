const mongoose = require('mongoose');

const ListingSchema = new mongoose.Schema(
  {
    // User & Profile Object References (Required for .populate())
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Category / Type handling
    type: {
      type: String,
      default: 'TSC Swap',
      enum: ['TSC Swap', 'BOM Vacancy', 'Seeking BOM Job', 'BOM Job'],
    },
    category: {
      type: String,
      default: function () {
        return this.type || 'TSC Swap';
      },
    },

    // Approval / Moderation Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      trim: true,
    },
    isApproved: {
      type: Boolean,
      default: function () {
        return this.status === 'approved';
      },
    },

    // User & Profile Information
    fullName: { type: String, default: 'Teacher', trim: true },
    teacherName: { type: String, trim: true },
    tscNumber: { type: String, default: '', trim: true },
    tscNo: { type: String, default: '', trim: true },
    tsc: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    phoneNumber: { type: String, default: '', trim: true },
    contactPhone: { type: String, default: '', trim: true },

    // Location Information
    county: { type: String, default: 'N/A', trim: true },
    currentCounty: { type: String, trim: true },
    subCounty: { type: String, default: '', trim: true },
    currentSchool: { type: String, default: '', trim: true },
    schoolName: { type: String, trim: true },

    // Target Location Information (For Swaps)
    targetCounty: { type: String, default: '' },
    targetSubCounty: { type: String, default: '' },
    targetLocation: { type: String, default: '' },

    // Subject & Job Information
    subjectCombination: { type: String, default: '' },
    subject: { type: String, default: '' },
    subjects: { type: String, default: '' },
    salary: { type: String, default: '' },
    isTscCompliant: { type: Boolean, default: false },
    isPaid: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    strict: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Synchronize fields BEFORE validation runs
ListingSchema.pre('validate', function (next) {
  // 1. Sync category and type
  if (this.category && !this.type) {
    this.type = this.category;
  } else if (this.type && !this.category) {
    this.category = this.type;
  }

  // 2. Sync teacherName with fullName
  if (this.fullName && !this.teacherName) {
    this.teacherName = this.fullName;
  } else if (this.teacherName && !this.fullName) {
    this.fullName = this.teacherName;
  }

  // 3. Sync currentCounty with county
  if (this.county && !this.currentCounty) {
    this.currentCounty = this.county;
  } else if (this.currentCounty && !this.county) {
    this.county = this.currentCounty;
  }

  // 4. Sync TSC Numbers across keys
  const resolvedTsc = this.tscNumber || this.tscNo || this.tsc;
  if (resolvedTsc) {
    this.tscNumber = String(resolvedTsc).trim();
    this.tscNo = String(resolvedTsc).trim();
    this.tsc = String(resolvedTsc).trim();
  }

  // 5. Sync isApproved boolean with status string
  if (this.status === 'approved') {
    this.isApproved = true;
  } else if (this.isApproved === true) {
    this.status = 'approved';
  }

  next();
});

module.exports = mongoose.model('Listing', ListingSchema);
