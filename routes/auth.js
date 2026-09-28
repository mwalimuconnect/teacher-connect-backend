const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Adjust path to your User model if needed

// POST /api/auth/register-or-login
router.post('/register-or-login', async (req, res) => {
  try {
    const { fullName, tscNumber, phone, nationalId, role } = req.body;

    // 1. Strict Format Validation
    const cleanPhone = (phone || '').replace(/\s+/g, '');
    const cleanTsc = (tscNumber || '').trim();
    const cleanId = (nationalId || '').trim();

    // Reject dummy phone numbers (e.g. 0712345678, 0700000000)
    const invalidPhones = ['0712345678', '0700000000', '0123456789', '0711111111'];
    if (invalidPhones.includes(cleanPhone) || !/^(07|01|\+254)[0-9]{8}$/.test(cleanPhone)) {
      return res.status(400).json({ 
        error: 'Please enter a valid Kenyan phone number (e.g., 0712345678 is reserved for testing).' 
      });
    }

    // Reject dummy TSC/ID numbers (must be valid 6-8 digits)
    const dummyPatterns = ['123456', '1234567', '12345678', '000000', '111111'];
    if (dummyPatterns.includes(cleanTsc) || cleanTsc.length < 5) {
      return res.status(400).json({ error: 'Please provide a valid TSC Number.' });
    }

    if (dummyPatterns.includes(cleanId) || cleanId.length < 6) {
      return res.status(400).json({ error: 'Please provide a valid National ID Number.' });
    }

    // 2. Lookup existing user by phone or ID
    let user = await User.findOne({
      $or: [{ phone: cleanPhone }, { nationalId: cleanId }, { tscNumber: cleanTsc }]
    });

    if (!user) {
      // REGISTER NEW USER -> Default status is set to PENDING for Admin Approval
      const isAdminRole = (role || '').toLowerCase().includes('admin') || cleanPhone === '0700000000'; // Define super-admin phone if needed
      
      user = new User({
        fullName,
        tscNumber: cleanTsc,
        phone: cleanPhone,
        nationalId: cleanId,
        role: role || 'Member Teacher',
        status: isAdminRole ? 'approved' : 'pending', // Require Admin Approval for standard teachers
        isApproved: isAdminRole
      });

      await user.save();
    }

    // 3. Admin Approval Check during login attempt
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
      token: 'jwt-token-placeholder' // Include your JWT signing logic here if applicable
    });

  } catch (error) {
    console.error('Registration/Login Error:', error);
    res.status(500).json({ error: 'Server error during authentication processing.' });
  }
});

module.exports = router;
