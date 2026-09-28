const express = require('express');
const router = express.Router();

// Mock initial resources or hook up to your Mongoose Resource Model
const sampleResources = [
  {
    id: '1',
    title: 'Form 4 English Schemes of Work (Term 1-3)',
    category: 'Schemes of Work',
    subject: 'English',
    fileUrl: 'https://example.com/schemes.pdf',
    price: 0
  },
  {
    id: '2',
    title: 'Blossoms of the Savannah Comprehensive Lesson Plan',
    category: 'Lesson Plans',
    subject: 'Literature',
    fileUrl: 'https://example.com/lesson_plan.pdf',
    price: 0
  }
];

// GET /api/resources - Fetch all resources or filter by category/search
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let results = [...sampleResources];

    if (category && category.toLowerCase() !== 'all') {
      results = results.filter(item => 
        item.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (search) {
      results = results.filter(item => 
        item.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Return direct array for Flutter parser
    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to load teacher resources' });
  }
});

// GET /api/resources/category/:category
router.get('/category/:category', async (req, res) => {
  try {
    const catParam = req.params.category;
    let results = [...sampleResources];

    if (catParam && catParam.toLowerCase() !== 'all') {
      results = results.filter(item => 
        item.category.toLowerCase().includes(catParam.toLowerCase())
      );
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching category resources:', error);
    res.status(500).json({ error: 'Failed to fetch category resources' });
  }
});

module.exports = router;
