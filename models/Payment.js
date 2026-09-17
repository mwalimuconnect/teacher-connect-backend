const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    mpesaReceiptNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    checkoutRequestID: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Pending',
    },
    description: {
      type: String,
      default: 'Listing Payment',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
