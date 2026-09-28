const express = require('express');
const router = express.Router();

const Listing = require('../models/Listing');
const User = require('../models/User');

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments();

    // Fix: Case-insensitive regex to catch both 'Pending' and 'pending'
    const pendingApprovals = await Listing.countDocuments({
      status: { $regex: /^pending$/i }
    });

    let totalMembers = 0;
try {
  const UserModel = mongoose.models.User || User;
  if (UserModel && typeof UserModel.countDocuments === 'function') {
    totalMembers = await UserModel.countDocuments();
  }
} catch (e) {
  totalMembers = 0;
}

    let totalPayments = 0;
    try {
      const mongoose = require('mongoose');
      // Retrieve the Payment model directly from Mongoose's registered models
      const PaymentModel = mongoose.models.Payment;

      if (PaymentModel) {
        const paymentResult = await PaymentModel.aggregate([
          { $match: { status: { $regex: /^completed$/i } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        if (paymentResult && paymentResult.length > 0) {
          totalPayments = paymentResult[0].total;
        }
      }
    } catch (e) {
      totalPayments = 0;
    }

    // Send aliases for all field name variations Flutter might check
    res.json({
      success: true,
      totalListings,
      pendingApprovals,
      totalPayments,
      paymentsReceived: totalPayments,
      totalMembers,
      data: {
        totalListings,
        pendingApprovals,
        totalPayments,
        paymentsReceived: totalPayments,
        totalMembers
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to compute stats' });
  }
});



// PATCH /api/admin/approve-listing/:id
router.patch('/approve-listing/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(updatedListing);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update listing status' });
  }
});

// GET /api/admin/bom-vacancies (Fetch all school vacancy posts)
router.get('/bom-vacancies', async (req, res) => {
  try {
    const vacancies = await Listing.find({
      type: { $regex: /bom_?vacancy/i }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vacancies.length,
      listings: vacancies,
      data: vacancies
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch BOM vacancies' });
  }
});

// GET /api/admin/bom-seekers (Fetch all teacher job seeker profiles)
router.get('/bom-seekers', async (req, res) => {
  try {
    const seekers = await Listing.find({
      type: { $regex: /bom_?seeker/i }
    }).sort({ createdAt: -1 });

    // GET /api/admin/pending-listings
router.get('/pending-listings', async (req, res) => {
  try {
    const pendingListings = await Listing.find({ 
      status: { $regex: /^pending$/i } 
    }).sort({ createdAt: -1 });

    const formatted = pendingListings.map(item => {
          const doc = item._doc || item;
    const phoneVal = item.phone || item.contactPhone || item.phoneNumber || item.contactNumber || 'N/A';
    const schoolVal = item.currentSchool || item.school || item.schoolName || 'N/A';
    const nameVal = item.fullName || item.teacherName || 'N/A';

    return {
      ...doc,
      teacherName: nameVal,
      phone: phoneVal,
      currentSchool: schoolVal,
      user: { name: nameVal, phone: phoneVal }
    };
  });

  res.status(200).json(formatted);
} catch (error) {
  console.error('Error fetching pending listings:', error);
  res.status(500).json({ error: 'Failed to fetch pending listings' });
}
});

// DELETE /api/admin/listing/:id (Delete any listing/vacancy)
router.delete('/listing/:id', async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
