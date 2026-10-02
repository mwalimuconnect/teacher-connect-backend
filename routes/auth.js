const express = require('express');
const router = express.Router();
const User = require('../models/user'); // Corrected lowercase path to match models/user.js

// 1. REGISTER ENDPOINT (/api/auth/register)
router.post('/register', async (req, res) => {
  try {
    const { fullName, tscNumber, phone, nationalId, idNumber, role, password } = req.body;

    const cleanPhone = (phone || '').replace(/\s+/g, '');
    const cleanTsc = (tscNumber || '').trim();
    const cleanId = (nationalId || idNumber || '').trim();

    // Strict Format Validation
    const invalidPhones = ['0712345678', '0700000000', '0123456789', '0711111111'];
    if (invalidPhones.includes(cleanPhone) || !/^(07|01|\+254)(0-9){8}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid Kenyan phone number.' });
    }

    const dummyPatterns = ['123456', '1234567', '12345678', '000000', '111111'];
    if (dummyPatterns.includes(cleanTsc) || cleanTsc.length < 5) {
      return res.status(400).json({ error: 'Please provide a valid TSC Number.' });
    }

    if (dummyPatterns.includes(cleanId) || cleanId.length < 5) {
      return res.status(400).json({ error: 'Please provide a valid National ID Number.' });
    }

    // Lookup existing user by phone, nationalId, or tscNumber
    let existingUser = await User.findOne({
      $or: [
        { phone: cleanPhone },
        { nationalId: cleanId },
        { tscNumber: cleanTsc }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with these credentials already exists. Please log in.' });
    }

    const isAdminRole = (role || '').toLowerCase().includes('admin');

    const user = new User({
      fullName,
      tscNumber: cleanTsc,
      phone: cleanPhone,
      nationalId: cleanId,
      role: role || 'Member Teacher',
      password,
      status: isAdminRole ? 'approved' : 'pending',
      isApproved: isAdminRole
    });

    await user.save();

    // Check approval status
    if (user.status === 'pending' || user.isApproved === false) {
      return res.status(201).json({
        message: 'Registration successful. Account pending admin approval.',
        user: {
          id: user._id,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          status: user.status
        }
      });
    }

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        tscNumber: user.tscNumber,
        role: user.role,
        status: user.status
      },
      token: 'jwt-token-placeholder'
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Server error during registration processing.' });
  }
});

// 2. LOGIN ENDPOINT (/api/auth/login)
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const cleanPhone = (phone || '').replace(/\s+/g, '');

    const user = await User.findOne({ phone: cleanPhone });

    if (!user) {
      return res.status(404).json({ error: 'Account not found. Please register first.' });
    }

    if (user.password !== password) {
      return res.status(400).json({ error: 'Invalid credentials. Please check your phone or password.' });
    }

    // Admin Approval Check
    if (user.status === 'pending' || user.isApproved === false) {
      return res.status(403).json({
        error: 'Your account is pending admin approval. Please wait for an admin to activate your profile.',
        pendingApproval: true
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'Your account registration was rejected by the administrator.'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        tscNumber: user.tscNumber,
        role: user.role,
        status: user.status
      },
      token: 'jwt-token-placeholder'
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login processing.' });
  }
});

// 3. ADMIN VERIFICATION ENDPOINT (/api/auth/admin/verify)
router.post('/admin/verify', (req, res) => {
  try {
    const { passcode } = req.body;

    if (!passcode) {
      return res.status(400).json({
        success: false,
        message: 'Passcode is required.'
      });
    }

    // Compares against ADMIN_PASSCODE defined in Vercel / .env environment variables
    if (passcode === process.env.ADMIN_PASSCODE) {
      return res.status(200).json({
        success: true,
        message: 'Admin passcode verified successfully.'
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin passcode.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during passcode verification.'
    });
  }
});

module.exports = router;
