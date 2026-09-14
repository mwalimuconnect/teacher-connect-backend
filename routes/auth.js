const express = require('express');
const router = express.Router();
const User = require('../models/User');

// REGISTER ENDPOINT: POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { fullName, tscNumber, phone, nationalId, role } = req.body;

    if (!fullName || !tscNumber || !phone || !nationalId) {
      return res.status(400).json({ 
        message: 'All fields (Full Name, TSC Number, Phone, National ID) are required.' 
      });
    }

    const existingUser = await User.findOne({
      $or: [{ tscNumber }, { nationalId }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'A user with this TSC Number or National ID already exists.' 
      });
    }

    const newUser = new User({
      fullName,
      tscNumber,
      phone,
      nationalId,
      role: role || 'Member Teacher'
    });

    await newUser.save();

    return res.status(201).json({
      message: 'Registration successful!',
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        tscNumber: newUser.tscNumber,
        phone: newUser.phone,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
});

// LOGIN ENDPOINT: POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { tscNumber, nationalId } = req.body;

    if (!tscNumber || !nationalId) {
      return res.status(400).json({ 
        message: 'Both TSC Number and National ID are required.' 
      });
    }

    const user = await User.findOne({ tscNumber, nationalId });

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid TSC Number or National ID.' 
      });
    }

    return res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user._id,
        fullName: user.fullName,
        tscNumber: user.tscNumber,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

module.exports = router;
