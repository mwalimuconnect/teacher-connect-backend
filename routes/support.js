const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');

// Submit a concern/help ticket
router.post('/submit', async (req, res) => {
  try {
    const { fullName, phoneNumber, subject, message } = req.body;
    
    if (!fullName || !phoneNumber || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const ticket = new SupportTicket({ fullName, phoneNumber, subject, message });
    await ticket.save();

    res.status(201).json({ message: 'Concern submitted successfully. Support will contact you soon.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
