const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // 'TSC Swap', 'BOM Vacancy', 'Seeking BOM Job'
    fullName: { type: String, required: true },
    county: { type: String, required: true },
    subCounty: { type: String, required: true },
    
    // Conditional / Optional Fields for TSC Swap
    subjectCombination: { type: String },
    phone: { type: String },
    currentSchool: { type: String },
    tscNumber: { type: String },
    targetCounty: { type: String },
    targetSubCounty: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Listing', listingSchema);
