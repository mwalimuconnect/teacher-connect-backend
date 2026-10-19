const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');

// =========================================================
// PRE-DEFINED COMPREHENSIVE KENYAN TSC SUBJECT COMBINATIONS
// =========================================================
const DEFAULT_KENYAN_SUBJECTS = [
  // Languages & Humanities
  { name: 'English / Literature', category: 'Humanities' },
  { name: 'Kiswahili / History', category: 'Humanities' },
  { name: 'Kiswahili / CRE', category: 'Humanities' },
  { name: 'Kiswahili / Geography', category: 'Humanities' },
  { name: 'Kiswahili / IRE', category: 'Humanities' },
  { name: 'History / CRE', category: 'Humanities' },
  { name: 'History / IRE', category: 'Humanities' },
  { name: 'Geography / CRE', category: 'Humanities' },
  { name: 'Geography / Business', category: 'Humanities' },
  { name: 'French / English', category: 'Languages' },
  { name: 'German / Any', category: 'Languages' },

  // Sciences & Mathematics (STEM)
  { name: 'Mathematics / Chemistry', category: 'Sciences' },
  { name: 'Mathematics / Biology', category: 'Sciences' },
  { name: 'Mathematics / Physics', category: 'Sciences' },
  { name: 'Physics / Chemistry', category: 'Sciences' },
  { name: 'Mathematics / Computer Studies', category: 'Sciences' },
  { name: 'Biology / Chemistry', category: 'Sciences' },

  // Technical, Applied & Business Studies
  { name: 'Business Studies / Mathematics', category: 'Technical & Business' },
  { name: 'Business Studies / Kiswahili', category: 'Technical & Business' },
  { name: 'Business Studies / History', category: 'Technical & Business' },
  { name: 'Business Studies / Computer Studies', category: 'Technical & Business' },
  { name: 'Agriculture / Biology', category: 'Technical & Business' },
  { name: 'Agriculture / Chemistry', category: 'Technical & Business' },
  { name: 'Agriculture / Geography', category: 'Technical & Business' },
  { name: 'Home Science / Biology', category: 'Technical & Business' },
  { name: 'Home Science / Chemistry', category: 'Technical & Business' },
  { name: 'Home Science / History', category: 'Technical & Business' },
  { name: 'Computer / Any', category: 'Technical & Business' },
  { name: 'HomeScience / Any', category: 'Technical & Business' }
];

// =========================================================
// INITIALIZE / SEED DEFAULT SUBJECTS ON STARTUP
// Uses $set so all default subjects are force-synced in MongoDB
// =========================================================
const seedDefaultSubjects = async () => {
  try {
    for (const subj of DEFAULT_KENYAN_SUBJECTS) {
      await Subject.updateOne(
        { name: subj.name },
        { 
          $set: { 
            category: subj.category, 
            isActive: true 
          },
          $setOnInsert: { 
            name: subj.name 
          } 
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('Error seeding default subjects:', err);
  }
};

// Run seed check when route file loads
seedDefaultSubjects();

// =========================================================
// 1. GET ALL ACTIVE SUBJECT COMBINATIONS (For Flutter Dropdown)
// =========================================================
router.get('/', async (req, res) => {
  try {
    const subjects = await Subject.find({ isActive: true }).sort({ name: 1 });
    const subjectList = subjects.map((s) => s.name);
    return res.status(200).json({ success: true, data: subjectList });
  } catch (err) {
    console.error('Error fetching subjects:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// =========================================================
// 2. ADD A NEW SUBJECT COMBINATION DYNAMICALLY
// =========================================================
router.post('/', async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Subject name is required' });
    }

    const newSubject = new Subject({ 
      name: name.trim(), 
      category: category || 'General' 
    });
    
    await newSubject.save();

    return res.status(201).json({
      success: true,
      message: 'New subject combination added successfully!',
      data: newSubject,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'This subject combination already exists.' });
    }
    console.error('Error adding subject:', err);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;
