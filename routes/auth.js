const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ================================================================
// 1. REGISTER ENDPOINT (/api/auth/register)
// ================================================================
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

    const cleanPhone = String(rawPhone).replace(/\s+/g, '');
    const cleanTsc = String(rawTsc).trim();
    const cleanId = String(rawId).trim();
    const cleanFullName = String(fullName || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanFullName || !cleanPhone || !cleanPassword) {
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

    const isAdminRole = String(role || '').toLowerCase() === 'admin';
    if (isAdminRole) {
      const expectedPasscode = process.env.ADMIN_PASSCODE;
      if (!expectedPasscode || String(adminPasscode) !== String(expectedPasscode)) {
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
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    const user = new User({
      fullName: cleanFullName,
      tscNumber: cleanTsc,
      phone: cleanPhone,
      nationalId: cleanId,
      currentSchool: currentSchool ? String(currentSchool).trim() : '',
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

// ================================================================
// 2. LOGIN ENDPOINT (/api/auth/login)
// ================================================================
router.post('/login', async (req, res) => {
  try {
    const { phone, phoneNumber, password } = req.body || {};

    const rawPhone = phoneNumber || phone || '';
    const cleanPhone = String(rawPhone).replace(/\s+/g, '');
    const inputPassword = String(password || '');

    if (!cleanPhone || !inputPassword) {
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

    const dbPassword = user.password ? String(user.password) : '';
    let isMatch = false;
    if (dbPassword.startsWith('$2')) {
      try {
        isMatch = await bcrypt.compare(inputPassword, dbPassword);
      } catch (err) {
        isMatch = false;
      }
    }

    const isPlaintextMatch = dbPassword === inputPassword;

    if (!isMatch && !isPlaintextMatch) {
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

// ================================================================
// 3. ADMIN VERIFICATION ENDPOINT (/api/auth/admin/verify)
// ================================================================
router.post('/admin/verify', async (req, res) => {
  try {
    const { passcode, adminPasscode } = req.body || {};
    const inputPasscode = String(passcode || adminPasscode || '');

    if (!inputPasscode) {
      return res.status(400).json({
        success: false,
        message: 'Passcode is required.',
      });
    }

    const expectedPasscode = process.env.ADMIN_PASSCODE;
    if (expectedPasscode && inputPasscode === String(expectedPasscode)) {
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
      error: error.message,
    });
  }
});

// ================================================================
// 4. RESET PASSWORD ENDPOINT (/api/auth/reset-password)
// ================================================================
router.post('/reset-password', async (req, res) => {
  try {
    const { phoneNumber, phone, idNumber, tscNumber, newPassword } = req.body || {};

    const rawPhone = phoneNumber || phone || '';
    const cleanPhone = String(rawPhone).replace(/\s+/g, '');
    const cleanId = String(idNumber || '').trim();
    const cleanTsc = String(tscNumber || '').trim();
    const cleanPassword = String(newPassword || '').trim();

    if (!cleanPhone || !cleanId || !cleanTsc || !cleanPassword) {
      return res.status(400).json({
        success: false,
        message: 'Phone number, ID number, TSC number, and new password are all required.',
      });
    }

    const user = await User.findOne({
      $and: [
        { $or: [{ phone: cleanPhone }, { phoneNumber: cleanPhone }] },
        { $or: [{ nationalId: cleanId }, { idNumber: cleanId }] },
        { tscNumber: cleanTsc },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Verification failed. Phone number, ID number, and TSC number do not match records.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(cleanPassword, salt);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during password reset.',
      error: error.message,
    });
  }
});

// ================================================================
// 5. GET USER PROFILE ENDPOINT (/api/auth/profile)
// ================================================================
router.get('/profile', async (req, res) => {
  try {
    const userId = req.query.userId || (req.user && req.user.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required to fetch profile.',
      });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        // Non-editable Identity Fields
        tscNumber: user.tscNumber || '',
        nationalId: user.nationalId || user.idNumber || '',
        // Editable Profile Fields
        currentSchool: user.currentSchool || '',
        county: user.county || '',
        subCounty: user.subCounty || '',
        subjects: user.subjects || [],
        role: user.role,
        status: user.status,
        profilePhotoUrl: user.profilePhotoUrl || '',
      },
    });
  } catch (error) {
    console.error('Fetch Profile Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching user profile.',
      error: error.message,
    });
  }
});

// ================================================================
// 6. UPDATE USER PROFILE ENDPOINT (/api/auth/profile)
// ================================================================
router.put('/profile', async (req, res) => {
  try {
    const {
      userId,
      fullName,
      phone,
      phoneNumber,
      currentSchool,
      county,
      subCounty,
      subjects,
      profilePhotoUrl,
    } = req.body || {};

    const targetUserId = userId || (req.user && req.user.userId);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required to update profile.',
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Phone validation if phone is being updated
    const rawPhone = phoneNumber || phone;
    if (rawPhone) {
      const cleanPhone = String(rawPhone).replace(/\s+/g, '');
      const kenyanPhoneRegex = /^(07|01|\+254)[0-9]{8}$/;
      if (!kenyanPhoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid Kenyan phone number.',
        });
      }
      user.phone = cleanPhone;
    }

    // Explicitly update ONLY permitted fields
    if (fullName !== undefined) user.fullName = String(fullName).trim();
    if (currentSchool !== undefined) user.currentSchool = String(currentSchool).trim();
    if (county !== undefined) user.county = String(county).trim();
    if (subCounty !== undefined) user.subCounty = String(subCounty).trim();
    if (subjects !== undefined) user.subjects = subjects;
    if (profilePhotoUrl !== undefined) user.profilePhotoUrl = profilePhotoUrl;

    // SECURITY NOTICE: tscNumber and nationalId/idNumber are intentionally excluded
    // to prevent tampering with official teacher verification records.

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        tscNumber: user.tscNumber,
        nationalId: user.nationalId,
        currentSchool: user.currentSchool,
        county: user.county,
        subCounty: user.subCounty,
        subjects: user.subjects,
        role: user.role,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile.',
      error: error.message,
    });
  }
});

// ================================================================
// 7. UPDATE PROFILE PHOTO ENDPOINT (/api/auth/update-photo/:userId)
// ================================================================
router.put('/update-photo/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { profilePhoto } = req.body;

    if (!userId || !profilePhoto) {
      return res.status(400).json({
        success: false,
        message: 'User ID and profile photo URL are required.',
      });
    }

    const updatedUser = await User.findById(userId);
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Save under both keys to ensure database persistence consistency
    updatedUser.profilePhotoUrl = profilePhoto;
    updatedUser.profilePhoto = profilePhoto;
    await updatedUser.save();

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully!',
      profilePhoto: updatedUser.profilePhotoUrl,
    });
  } catch (error) {
    console.error('Update Photo Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile photo.',
      error: error.message,
    });
  }
});
    
module.exports = router;
