Const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ================================================================
// 1. REGISTER ENDPOINT (/api/auth/register)
// ================================================================
router.post('/register', async (req, res) => {
  try {
    Const {
      fullName,
      tscNumber,
      nationalId,
      idNumber,
      phone,
      phoneNumber,
      subjectCombination,
      subjects,
      currentSchool,
      role,
      password,
      adminPasscode,
    } = req.body || {};

    Const rawPhone = phoneNumber || phone || '';
    Const rawId = nationalId || idNumber || '';
    Const rawTsc = tscNumber || '';
    Const rawSubject = subjectCombination || subjects || '';

    Const cleanPhone = String(rawPhone).replace(/\s+/g, '');
    Const cleanTsc = String(rawTsc).trim();
    Const cleanId = String(rawId).trim();
    Const cleanFullName = String(fullName || '').trim();
    Const cleanSubjectCombo = String(rawSubject).trim();
    Const cleanPassword = String(password || '');

    If (!cleanFullName || !cleanPhone || !cleanPassword || !cleanSubjectCombo) {
      Return res.status(400).json({
        Success: false,
        Message: 'Full Name, Phone Number, Subject Combination, and Password are required.',
      });
    }

    Const invalidPhones = ['0712345678', '0700000000'];
    Const kenyanPhoneRegex = /^(07|01|\+254)[0-9]{8}$/;

    If (invalidPhones.includes(cleanPhone) || !kenyanPhoneRegex.test(cleanPhone)) {
      Return res.status(400).json({
        Success: false,
        Message: 'Please enter a valid Kenyan phone number.',
      });
    }

    Const isAdminRole = String(role || '').toLowerCase() === 'admin';
    If (isAdminRole) {
      Const expectedPasscode = process.env.ADMIN_PASSCODE;
      If (!expectedPasscode || String(adminPasscode) !== String(expectedPasscode)) {
        Return res.status(401).json({
          Success: false,
          Message: 'Invalid Admin Security Passcode.',
        });
      }
    }

    Const orConditions = [{ phone: cleanPhone }];
    If (cleanId) orConditions.push({ nationalId: cleanId });
    If (cleanTsc) orConditions.push({ tscNumber: cleanTsc });

    Const existingUser = await User.findOne({ $or: orConditions });
    If (existingUser) {
      Return res.status(400).json({
        Success: false,
        Message: 'An account with these credentials already exists.',
      });
    }

    // Hash the password securely
    Const salt = await bcrypt.genSalt(10);
    Const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    Const user = new User({
      FullName: cleanFullName,
      TscNumber: cleanTsc,
      Phone: cleanPhone,
      NationalId: cleanId,
      SubjectCombination: cleanSubjectCombo,
      Subjects: cleanSubjectCombo,
      Subject: cleanSubjectCombo,
      CurrentSchool: currentSchool ? String(currentSchool).trim() : '',
      Role: role || 'Member Teacher',
      Password: hashedPassword,
      Status: isAdminRole ? 'approved' : 'pending',
      IsApproved: isAdminRole,
      CanEditTsc: false, // Default locked identity permission
    });

    await user.save();

    // Generate valid JWT token
    Const token = jwt.sign(
      { userId: user._id, role: user.role, phone: user.phone },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '30d' }
    );

    If (user.status === 'pending' || !user.isApproved) {
      Return res.status(201).json({
        Success: true,
        Message: 'Registration successful. Account pending admin approval.',
        User: {
          Id: user._id,
          FullName: user.fullName,
          Phone: user.phone,
          SubjectCombination: user.subjectCombination,
          Role: user.role,
          Status: user.status,
        },
        Token,
      });
    }

    Return res.status(201).json({
      Success: true,
      Message: 'Registration successful!',
      User: {
        Id: user._id,
        FullName: user.fullName,
        Phone: user.phone,
        TscNumber: user.tscNumber,
        SubjectCombination: user.subjectCombination,
        Role: user.role,
        Status: user.status,
      },
      Token,
    });
  } catch (error) {
    Console.error('Registration Error:', error);
    Return res.status(500).json({
      Success: false,
      Message: 'Server error during registration.',
      Error: error.message,
    });
  }
});

// ================================================================
// 2. LOGIN ENDPOINT (/api/auth/login)
// ================================================================
router.post('/login', async (req, res) => {
  Try {
    Const { phone, phoneNumber, password } = req.body || {};

    Const rawPhone = phoneNumber || phone || '';
    Const cleanPhone = String(rawPhone).replace(/\s+/g, '');
    Const inputPassword = String(password || '');

    If (!cleanPhone || !inputPassword) {
      Return res.status(400).json({
        Success: false,
        Message: 'Phone number and password are required.',
      });
    }

    Const user = await User.findOne({ phone: cleanPhone });
    If (!user) {
      Return res.status(404).json({
        Success: false,
        Message: 'Account not found. Please register first.',
      });
    }

    Const dbPassword = user.password ? String(user.password) : '';
    Let isMatch = false;
    If (dbPassword.startsWith('$2')) {
      Try {
        IsMatch = await bcrypt.compare(inputPassword, dbPassword);
      } catch (err) {
        IsMatch = false;
      }
    }

    Const isPlaintextMatch = dbPassword === inputPassword;

    If (!isMatch && !isPlaintextMatch) {
      Return res.status(401).json({
        Success: false,
        Message: 'Invalid credentials. Please check your phone number and password.',
      });
    }

    If (user.status === 'pending' || !user.isApproved) {
      Return res.status(403).json({
        Success: false,
        Message: 'Your account is pending admin approval.',
        PendingApproval: true,
      });
    }

    If (user.status === 'rejected') {
      Return res.status(403).json({
        Success: false,
        Message: 'Your account registration was rejected.',
      });
    }

    Const token = jwt.sign(
      { userId: user._id, role: user.role, phone: user.phone },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '30d' }
    );

    Return res.status(200).json({
      Success: true,
      Message: 'Login successful!',
      User: {
        Id: user._id,
        FullName: user.fullName,
        Phone: user.phone,
        TscNumber: user.tscNumber,
        SubjectCombination: user.subjectCombination || user.subjects || '',
        Role: user.role,
        Status: user.status,
      },
      Token,
    });
  } catch (error) {
    Console.error('Login Error:', error);
    Return res.status(500).json({
      Success: false,
      Message: 'Server error during login processing.',
      Error: error.message,
    });
  }
});

// ================================================================
// 3. ADMIN VERIFICATION ENDPOINT (/api/auth/admin/verify)
// ================================================================
router.post('/admin/verify', async (req, res) => {
  Try {
    Const { passcode, adminPasscode } = req.body || {};
    Const inputPasscode = String(passcode || adminPasscode || '');

    If (!inputPasscode) {
      Return res.status(400).json({
        Success: false,
        Message: 'Passcode is required.',
      });
    }

    Const expectedPasscode = process.env.ADMIN_PASSCODE;
    If (expectedPasscode && inputPasscode === String(expectedPasscode)) {
      Return res.status(200).json({
        Success: true,
        Message: 'Admin passcode verified successfully.',
      });
    } else {
      Return res.status(401).json({
        Success: false,
        Message: 'Invalid admin passcode.',
      });
    }
  } catch (error) {
    Console.error('Passcode Verification Error:', error);
    Return res.status(500).json({
      Success: false,
      Message: 'Server error during passcode verification.',
      Error: error.message,
    });
  }
});

// ================================================================
// 4. RESET PASSWORD ENDPOINT (/api/auth/reset-password)
// ================================================================
router.post('/reset-password', async (req, res) => {
  Try {
    Const { phoneNumber, phone, idNumber, tscNumber, newPassword } = req.body || {};

    Const rawPhone = phoneNumber || phone || '';
    Const cleanPhone = String(rawPhone).replace(/\s+/g, '');
    Const cleanId = String(idNumber || '').trim();
    Const cleanTsc = String(tscNumber || '').trim();
    Const cleanPassword = String(newPassword || '').trim();

    If (!cleanPhone || !cleanId || !cleanTsc || !cleanPassword) {
      Return res.status(400).json({
        Success: false,
        Message: 'Phone number, ID number, TSC number, and new password are all required.',
      });
    }

    Const user = await User.findOne({
      $and: [
        { $or: [{ phone: cleanPhone }, { phoneNumber: cleanPhone }] },
        { $or: [{ nationalId: cleanId }, { idNumber: cleanId }] },
        { tscNumber: cleanTsc },
      ],
    });

    If (!user) {
      Return res.status(404).json({
        Success: false,
        Message: 'Verification failed. Phone number, ID number, and TSC number do not match records.',
      });
    }

    Const salt = await bcrypt.genSalt(10);
    User.password = await bcrypt.hash(cleanPassword, salt);
    await user.save();

    Return res.status(200).json({
      Success: true,
      Message: 'Password reset successfully! You can now log in.',
    });
  } catch (error) {
    Console.error('Reset Password Error:', error);
    Return res.status(500).json({
      Success: false,
      Message: 'Server error during password reset.',
      Error: error.message,
    });
  }
});

// ================================================================
// 5. GET USER PROFILE ENDPOINT (/api/auth/profile)
// ================================================================
router.get('/profile', async (req, res) => {
  Try {
    Const userId = req.query.userId || (req.user && req.user.userId);

    If (!userId) {
      Return res.status(400).json({
        Success: false,
        Message: 'User ID is required to fetch profile.',
      });
    }

    Const user = await User.findById(userId).select('-password');
    If (!user) {
      Return res.status(404).json({
        Success: false,
        Message: 'User profile not found.',
      });
    }

    Return res.status(200).json({
      Success: true,
      User: {
        Id: user._id,
        FullName: user.fullName,
        Phone: user.phone,
        // Non-editable Identity Fields & Admin Permission Flag
        TscNumber: user.tscNumber || '',
        NationalId: user.nationalId || user.idNumber || '',
        CanEditTsc: user.canEditTsc || false, // <-- Expose edit permission state to Flutter app
        // Editable Profile Fields
        CurrentSchool: user.currentSchool || '',
        County: user.county || '',
        SubCounty: user.subCounty || '',
        SubjectCombination: user.subjectCombination || user.subjects || '',
        Subjects: user.subjectCombination || user.subjects || '',
        Role: user.role,
        Status: user.status,
        ProfilePhotoUrl: user.profilePhotoUrl || '',
      },
    });
  } catch (error) {
    Console.error('Fetch Profile Error:', error);
    Return res.status(500).json({
      Success: false,
      Message: 'Server error fetching user profile.',
      Error: error.message,
    });
  }
});

// ================================================================
// 6. UPDATE USER PROFILE ENDPOINT (/api/auth/profile)
// ================================================================
router.put('/profile', async (req, res) => {
  Try {
    Const {
      UserId,
      FullName,
      Phone,
      PhoneNumber,
      TscNumber,
      NationalId,
      IdNumber,
      CurrentSchool,
      County,
      SubCounty,
      SubjectCombination,
      Subjects,
      ProfilePhotoUrl,
      ProfilePhoto,
    } = req.body || {};

    Const targetUserId = userId || (req.user && req.user.userId);

    If (!targetUserId) {
      Return res.status(400).json({
        Success: false,
        Message: 'User ID is required to update profile.',
      });
    }

    Const user = await User.findById(targetUserId);
    If (!user) {
      Return res.status(404).json({
        Success: false,
        Message: 'User not found.',
      });
    }

    // Handle Identity Fields (TSC and National ID) guarded by canEditTsc permission
    Const rawNewTsc = TscNumber;
    Const rawNewId = NationalId || IdNumber;

    If (rawNewTsc !== undefined || rawNewId !== undefined) {
      If (user.canEditTsc) {
        If (rawNewTsc !== undefined) user.tscNumber = String(rawNewTsc).trim();
        If (rawNewId !== undefined) {
          User.nationalId = String(rawNewId).trim();
          User.idNumber = String(rawNewId).trim();
        }
        // Automatically re-lock identity fields after a successful update for security
        User.canEditTsc = false;
      } else {
        // Block if user attempts modification without admin permission
        If (
          (rawNewTsc !== undefined && String(rawNewTsc).trim() !== String(user.tscNumber || '')) ||
          (rawNewId !== undefined && String(rawNewId).trim() !== String(user.nationalId || user.idNumber || ''))
        ) {
          Return res.status(403).json({
            Success: false,
            Message: 'Permission denied. ID and TSC numbers are locked. Contact Admin to unlock.',
          });
        }
      }
    }

    // Phone validation if phone is being updated
    Const rawPhone = phoneNumber || phone;
    If (rawPhone) {
      Const cleanPhone = String(rawPhone).replace(/\s+/g, '');
      Const kenyanPhoneRegex = /^(07|01|\+254)[0-9]{8}$/;
      If (!kenyanPhoneRegex.test(cleanPhone)) {
        Return res.status(400).json({
          Success: false,
          Message: 'Please enter a valid Kenyan phone number.',
        });
      }
      User.phone = cleanPhone;
    }

    Const newSubject = subjectCombination || subjects;
    Const resolvedPhoto = profilePhotoUrl || profilePhoto;

    // Explicitly update permitted fields
    If (fullName !== undefined) user.fullName = String(fullName).trim();
    If (currentSchool !== undefined) user.currentSchool = String(currentSchool).trim();
    If (county !== undefined) user.county = String(county).trim();
    If (subCounty !== undefined) user.subCounty = String(subCounty).trim();
    If (newSubject !== undefined) {
      User.subjectCombination = String(newSubject).trim();
      User.subjects = String(newSubject).trim();
    }
    
    // Save photo to both keys for complete data consistency across the app
    If (resolvedPhoto !== undefined) {
      User.profilePhotoUrl = resolvedPhoto;
      User.profilePhoto = resolvedPhoto;
    }

    await user.save();

    Return res.status(200).json({
      Success: true,
      Message: 'Profile updated successfully!',
      User: {
        Id: user._id,
        FullName: user.fullName,
        Phone: user.phone,
        TscNumber: user.tscNumber,
        NationalId: user.nationalId,
        CanEditTsc: user.canEditTsc,
        CurrentSchool: user.currentSchool,
        County: user.county,
        SubCounty: user.subCounty,
        SubjectCombination: user.subjectCombination,
        Role: user.role,
        ProfilePhotoUrl: user.profilePhotoUrl,
        ProfilePhoto: user.profilePhoto,
      },
    });
  } catch (error) {
    Console.error('Update Profile Error:', error);
    Return res.status(500).json({
      Success: false,
      Message: 'Server error updating profile.',
      Error: error.message,
    });
  }
});

// ================================================================
// 7. UPDATE PROFILE PHOTO ENDPOINT (/api/auth/update-photo/:userId)
// ================================================================
router.put('/update-photo/:userId', async (req, res) => {
  Try {
    Const { userId } = req.params;
    Const { profilePhoto } = req.body;

    If (!userId || !profilePhoto) {
      Return res.status(400).json({
        Success: false,
        Message: 'User ID and profile photo URL are required.',
      });
    }

    Const updatedUser = await User.findById(userId);
    If (!updatedUser) {
      Return res.status(404).json({
        Success: false,
        Message: 'User not found.',
      });
    }

    // Save under both keys to ensure database persistence consistency
    UpdatedUser.profilePhotoUrl = profilePhoto;
    UpdatedUser.profilePhoto = profilePhoto;
    await updatedUser.save();

    Return res.status(200).json({
      Success: true,
      Message: 'Profile photo updated successfully!',
      ProfilePhoto: updatedUser.profilePhotoUrl,
    });
  } catch (error) {
    Console.error('Update Photo Error:', error);
    Return res.status(500).json({
      Success: false,
      Message: 'Server error updating profile photo.',
      Error: error.message,
    });
  }
});
    
module.exports = router;
