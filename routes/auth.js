const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Adjust path to your User model if needed

// Combined endpoint handling distinct Login vs Registration actions
router.post('/register-or-login', async (req, res) => {
  try {
    const { fullName, tscNumber, phone, nationalId, role, isLogin } = req.body;

    const cleanPhone = (phone || '').replace(/\s+/g, '');
    const cleanTsc = (tscNumber || '').trim();
    const cleanId = (nationalId || '').trim();

    // 1. Strict Format Validation
    const invalidPhones = ['0712345678', '0700000000', '0123456789', '0711111111'];
    if (!isLogin && (invalidPhones.includes(cleanPhone) || !/^(07|01|\+254)[0-9]{8}$/.test(cleanPhone))) {
      return res.status(400).json({ error: 'Please enter a valid Kenyan phone number.' });
    }

    const dummyPatterns = ['123456', '1234567', '12345678', '000000', '111111'];
    if (dummyPatterns.includes(cleanTsc) || cleanTsc.length < 5) {
      return res.status(400).json({ error: 'Please provide a valid TSC Number.' });
    }

    if (dummyPatterns.includes(cleanId) || cleanId.length < 5) {
      return res.status(400).json({ error: 'Please provide a valid National ID Number.' });
    }

    // 2. Lookup existing user
    let user = await User.findOne({
      $or: [{ nationalId: cleanId }, { tscNumber: cleanTsc }]
    });

    // Handle LOGIN Attempt
    if (isLogin) {
      if (!user) {
        return res.status(404).json({ error: 'Account not found. Please register first.' });
      }
    } else {
      // Handle REGISTER Attempt
      if (user) {
        return res.status(400).json({ error: 'An account with these credentials already exists. Please log in.' });
      }

      const isAdminRole = (role || '').toLowerCase().includes('admin');

      user = new User({
        fullName,
        tscNumber: cleanTsc,
        phone: cleanPhone,
        nationalId: cleanId,
        role: role || 'Member Teacher',
        status: isAdminRole ? 'approved' : 'pending',
        isApproved: isAdminRole
      });

      await user.save();
    }

    // 3. Admin Approval Check during access attempt
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

    // 4. Return successful response with User details & Token
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
    console.error('Registration/Login Error:', error);
    res.status(500).json({ error: 'Server error during authentication processing.' });
  }
});

module.exports = router;
