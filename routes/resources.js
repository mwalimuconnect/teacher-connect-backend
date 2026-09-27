const express = require('express');
const router = express.Router();

// GET all resources
router.get('/', async (req, res) => {
  try {
    const resources = [
      {
        _id: '1',
        title: 'Form 3 English Schemes of Work',
        category: 'Schemes of Work',
        subject: 'English',
        form: 'Form 3'
      }
    ];
    res.status(200).json(resources);
} catch (error) {
  res.status(500).json({ message: error.message });
  }

module.exports = router;
