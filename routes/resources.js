const express = require('express');
const router = express.Router();
// Import your Resource model (adjust path if needed)
const Resource = require('../models/TeacherResource'); 

// GET all resources
router.get('/', async (req, res) => {
  try {
    const resources = await Resource.find();
    res.status(200).json(resources);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
