const mongoose = require('mongoose');

const ListingSchema = new mongoose.Schema(
  {
    // Category / Type handling
    type: {
      type: String,
      required: true,
      default: 'TSC Swap',
      enum: ['TSC Swap', 'BOM Vacancy', 'Seeking BOM Job'],
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

    // User & Profile Information
    fullName: { type: String, required: true, trim: true },
    teacherName: { type: String, trim: true },
    tscNumber: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    phoneNumber: { type: String, default: '', trim: true },

    // Location Information
    county: { type: String, required: true, trim: true },
    currentCounty: { type: String, trim: true },
    subCounty: { type: String, required: true, trim: true },
    currentSchool: { type: String, default: '', trim: true },

    // Target Location Information (For Swaps)
    targetCounty: { type: String, default: '' },
    targetSubCounty: { type: String, default: '' },
    targetLocation: { type: String, default: '' },

    // Subject & Job Information
    subjectCombination: { type: String, default: '' },
    subject: { type: String, default: '' },
    subjects: { type: String, default: '' },
  },
  {
    timestamps: true,
    // Ensures virtual fields and aliases pass through nicely in JSON
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-sync category/type and field aliases before saving
ListingSchema.pre('save', function (next) {
  if (this.category && !this.type) {
    this.type = this.category;
  } else if (this.type && !this.category) {
    this.category = this.type;
  }

  // Sync alias teacherName with fullName
  if (this.fullName && !this.teacherName) {
    this.teacherName = this.fullName;
  } else if (this.teacherName && !this.fullName) {
    this.fullName = this.teacherName;
  }

  // Sync alias currentCounty with county
  if (this.county && !this.currentCounty) {
    this.currentCounty = this.county;
  } else if (this.currentCounty && !this.county) {
    this.county = this.currentCounty;
  }

  next();
});

module.exports = mongoose.model('Listing', ListingSchema);
