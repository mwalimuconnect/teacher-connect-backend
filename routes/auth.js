const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ============================================================================
// 1. REGISTER ENDPOINT (/api/auth/register)
// ============================================================================
router.post('/register', async (req, res) => {
  try {
    const {
      fullName,
      tscNumber,
      nationalId,
      idNumber,
      phone,
      phoneNumber,
      currentSchool,
      role,
      password,
      adminPasscode,
    } = req.body || {};

    const rawPhone = phoneNumber || phone || '';
    const rawId = nationalId || idNumber || '';
    const rawTsc = tscNumber || '';

    const cleanPhone = rawPhone.replace(/\s+/g, '');
    const cleanTsc = rawTsc.trim();
    const cleanId = rawId.trim();

    if (!fullName || !cleanPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Phone Number, and Password are required.',
      });
    }

    const invalidPhones = ['0712345678', '0700000000'];
    const kenyanPhoneRegex = /^(07|01|\+254)[0-9]{8}$/;

    if (invalidPhones.includes(cleanPhone) || !kenyanPhoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Kenyan phone number.',
      });
    }

    const isAdminRole = (role || '').toLowerCase() === 'admin';
    if (isAdminRole) {
      const expectedPasscode = process.env.ADMIN_PASSCODE;
      if (!expectedPasscode || adminPasscode !== expectedPasscode) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Admin Security Passcode.',
        });
      }
    }

    const orConditions = [{ phone: cleanPhone }];
    if (cleanId) orConditions.push({ nationalId: cleanId });
    if (cleanTsc) orConditions.push({ tscNumber: cleanTsc });

    const existingUser = await User.findOne({ $or: orConditions });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with these credentials already exists.',
      });
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      fullName: fullName.trim(),
      tscNumber: cleanTsc,
      phone: cleanPhone,
      nationalId: cleanId,
      currentSchool: currentSchool ? currentSchool.trim() : '',
      role: role || 'Member Teacher',
      password: hashedPassword,
      status: isAdminRole ? 'approved' : 'pending',
      isApproved: isAdminRole,
    });

    await user.save();

    // Generate valid JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role, phone: user.phone },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '30d' }
    );

    if (user.status === 'pending' || !user.isApproved) {
      return res.status(201).json({
        success: true,
        message: 'Registration successful. Account pending admin approval.',
        user: {
          id: user._id,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          status: user.status,
        },
        token,
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
        status: user.status,
      },
      token,
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration.',
      error: error.message,
    });
  }
});

// ============================================================================
// 2. LOGIN ENDPOINT (/api/auth/login)
// ============================================================================
router.post('/login', async (req, res) => {
  try {
    const { phone, phoneNumber, password } = req.body || {};

    const rawPhone = phoneNumber || phone || '';
    const cleanPhone = rawPhone.replace(/\s+/g, '');

    if (!cleanPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required.',
      });
    }

    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please register first.',
      });
    }

    // Compare hashed password safely
    const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
    // Fallback check for legacy unhashed plain text passwords
    const isPlainTextMatch = user.password === password;

    if (!isMatch && !isPlainTextMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your phone number and password.',
      });
    }

    if (user.status === 'pending' || !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval.',
        pendingApproval: true,
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account registration was rejected.',
      });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, role: user.role, phone: user.phone },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        tscNumber: user.tscNumber,
        role: user.role,
        status: user.status,
      },
      token,
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login processing.',
      error: error.message,
    });
  }
});

// ============================================================================
// 3. ADMIN VERIFICATION ENDPOINT (/api/auth/admin/verify)
// ============================================================================
router.post('/admin/verify', async (req, res) => {
  try {
    const { passcode, adminPasscode } = req.body || {};
    const inputPasscode = passcode || adminPasscode;

    if (!inputPasscode) {
      return res.status(400).json({
        success: false,
        message: 'Passcode is required.',
      });
    }

    const expectedPasscode = process.env.ADMIN_PASSCODE;
    if (expectedPasscode && inputPasscode === expectedPasscode) {
      return res.status(200).json({
        success: true,
        message: 'Admin passcode verified successfully.',
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin passcode.',
      });
    }
  } catch (error) {
    console.error('Passcode Verification Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during passcode verification.',
    });
  }
});

module.exports = router;
