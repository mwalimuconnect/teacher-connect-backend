const express = require('express');
const router = express.Router();

const User = require('../models/User');

// =========================================================================
// 1. REGISTER ENDPOINT (/api/auth/register)
// =========================================================================
router.post('/register', async (req, res) => {
  try {
    const {
      fullName,
      tscNumber,
      nationalId,
      idNumber, // Accept both nationalId or idNumber from Flutter
      phone,
      phoneNumber, // Accept both phone or phoneNumber from Flutter
      currentSchool,
      role,
      password,
      adminPasscode
    } = req.body;

    // Standardize input fields across frontends
    const rawPhone = phoneNumber || phone || '';
    const rawId = nationalId || idNumber || '';
    const rawTsc = tscNumber || '';

    const cleanPhone = rawPhone.replace(/\s+/g, '').trim();
    const cleanTsc = rawTsc.trim();
    const cleanId = rawId.trim();

    // Basic Validation
    if (!fullName || !cleanPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Phone Number, and Password are required.'
      });
    }

    // Strict Format Validation
    const invalidPhones = ['0712345678', '0700000000', '0123456789', '0711111111'];
    const kenyanPhoneRegex = /^(07|01|\+254)[0-9]{8}$/;

    if (invalidPhones.includes(cleanPhone) || (!kenyanPhoneRegex.test(cleanPhone) && cleanPhone.length < 10)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Kenyan phone number.'
      });
    }

    // Admin Verification Passcode Check
    const isAdminRole = (role || '').toLowerCase().includes('admin');
    if (isAdminRole) {
      const expectedPasscode = process.env.ADMIN_PASSCODE || '31079824';
      if (expectedPasscode && adminPasscode !== expectedPasscode) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Admin Security Passcode.'
        });
      }
    }

    // Build lookup query array safely
    const orConditions = [{ phone: cleanPhone }];
    if (cleanId) orConditions.push({ nationalId: cleanId });
    if (cleanTsc) orConditions.push({ tscNumber: cleanTsc });

    // Lookup existing user by phone, nationalId, or tscNumber
    const existingUser = await User.findOne({ $or: orConditions });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with these credentials already exists. Please log in.'
      });
    }

    // Create New User
    const user = new User({
      fullName: fullName.trim(),
      tscNumber: cleanTsc,
      phone: cleanPhone,
      nationalId: cleanId,
      currentSchool: currentSchool ? currentSchool.trim() : '',
      role: role || 'Member Teacher',
      password, // Note: Consider hashing with bcrypt in production
      status: isAdminRole ? 'approved' : 'pending',
      isApproved: isAdminRole
    });

    await user.save();

    if (user.status === 'pending' || user.isApproved === false) {
      return res.status(201).json({
        success: true,
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

    return res.status(201).json({
      success: true,
      message: 'Registration successful!',
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
    return res.status(500).json({
      success: false,
      message: 'Server error during registration processing.',
      error: error.message
    });
  }
});

// =========================================================================
// 2. LOGIN ENDPOINT (/api/auth/login)
// =========================================================================
router.post('/login', async (req, res) => {
  try {
    const { phone, phoneNumber, password } = req.body;
    const rawPhone = phoneNumber || phone || '';
    const cleanPhone = rawPhone.replace(/\s+/g, '').trim();

    if (!cleanPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required.'
      });
    }

    const user = await User.findOne({ phone: cleanPhone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please register first.'
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your phone or password.'
      });
    }

    // Admin Approval Check
    if (user.status === 'pending' || user.isApproved === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please wait for an admin to activate your profile.',
        pendingApproval: true
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account registration was rejected by the administrator.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
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
    return res.status(500).json({
      success: false,
      message: 'Server error during login processing.',
      error: error.message
    });
  }
});

// =========================================================================
// 3. ADMIN VERIFICATION ENDPOINT (/api/auth/admin/verify)
// =========================================================================
router.post('/admin/verify', async (req, res) => {
  try {
    const { passcode } = req.body;

    if (!passcode) {
      return res.status(400).json({
        success: false,
        message: 'Passcode is required.'
      });
    }

    const expectedPasscode = process.env.ADMIN_PASSCODE || '31079824';

    if (passcode === expectedPasscode) {
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
    console.error('Passcode Verification Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during passcode verification.'
    });
  }
});

module.exports = router;
