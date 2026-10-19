const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');

// =========================================================
// 1. SUBMIT SUPPORT TICKET (/api/support/submit)
// =========================================================
router.post('/submit', async (req, res) => {
  try {
    const { fullName, phoneNumber, subject, message } = req.body;

    if (!fullName || !phoneNumber || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required.' 
      });
    }

    const ticket = new SupportTicket({
      fullName: String(fullName).trim(),
      phoneNumber: String(phoneNumber).trim(),
      subject: String(subject).trim(),
      message: String(message).trim(),
    });

    await ticket.save();

    return res.status(201).json({ 
      success: true, 
      message: 'Concern submitted successfully. Support will contact you soon.' 
    });
  } catch (err) {
    console.error('Submit Support Ticket Error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// =========================================================
// 2. FETCH ALL SUPPORT TICKETS (/api/support/all & /api/support)
// =========================================================
router.get(['/all', '/'], async (req, res) => {
  try {
    const tickets = await SupportTicket.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: tickets,
      tickets: tickets
    });
  } catch (error) {
    console.error('Fetch Support Tickets Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching tickets.',
    });
  }
});

// =========================================================
// 3. DELETE / DISMISS SUPPORT TICKET (/api/support/:id)
// =========================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTicket = await SupportTicket.findByIdAndDelete(id);

    if (!deletedTicket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket dismissed successfully.'
    });
  } catch (error) {
    console.error('Delete Support Ticket Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting ticket.'
    });
  }
});

module.exports = router;
