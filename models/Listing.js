const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
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

    // User & Profile Information
    fullName: { type: String, required: true, trim: true },
    teacherName: { type: String, trim: true },
    tscNumber: { type: String, default: '' },
    phone: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },

    // Location Information
    county: { type: String, required: true, trim: true },
    currentCounty: { type: String, trim: true },
    subCounty: { type: String, required: true, trim: true },
    currentSchool: { type: String, default: '' },

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

// Auto-sync category and type before saving
listingSchema.pre('save', function (next) {
  if (this.category && !this.type) {
    this.type = this.category;
  } else if (this.type && !this.category) {
    this.category = this.type;
  }

  if (this.fullName && !this.teacherName) {
    this.teacherName = this.fullName;
  }

  if (this.county && !this.currentCounty) {
    this.currentCounty = this.county;
  }

  next();
});

module.exports = mongoose.model('Listing', listingSchema);
