const express = require('express');
const router = express.Router();
const axios = require('axios');
const Payment = require('../models/Payment');

// Helper function to generate M-Pesa OAuth Access Token
const getMpesaToken = async (req, res, next) => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );
    req.accessToken = response.data.access_token;
    next();
  } catch (error) {
    console.error('Error fetching M-Pesa access token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with M-Pesa' });
  }
};

// 1. POST: Initiate STK Push & Save Initial 'Pending' Payment Record
router.post('/stkpush', getMpesaToken, async (req, res) => {
  try {
    const { userId, phone, amount, accountReference, description } = req.body;

    // Format phone to 254XXXXXXXXX
    let formattedPhone = phone.trim().replace('+', '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    }

    const shortCode = process.env.MPESA_PAYBILL;
    const passkey = process.env.MPESA_PASSKEY;
    
    // Generate Timestamp (YYYYMMDDHHmmss)
    const date = new Date();
    const timestamp =
      date.getFullYear().toString() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
    const callbackUrl = `${process.env.BACKEND_URL}/api/mpesa/callback`;

    // Call Safaricom STK Push API
    const response = await axios.post(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(Number(amount)),
        PartyA: formattedPhone,
        PartyB: shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference || 'TeacherConnect',
        TransactionDesc: description || 'Listing Payment',
      },
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { CheckoutRequestID, ResponseCode } = response.data;

    if (ResponseCode === '0') {
      // Save initial record in MongoDB matched to your schema
      await Payment.create({
        userId: userId,
        phoneNumber: formattedPhone,
        amount: Math.round(Number(amount)),
        checkoutRequestID: CheckoutRequestID,
        status: 'Pending',
        description: description || 'Listing Payment',
      });

      return res.status(200).json({
        success: true,
        message: 'STK Push initiated successfully',
        checkoutRequestID: CheckoutRequestID,
      });
    } else {
      return res.status(400).json({ success: false, error: 'STK Push failed to initiate' });
    }
  } catch (error) {
    console.error('Error initiating STK Push:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 2. POST: M-Pesa Callback Webhook (Called automatically by Safaricom)
router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

    const stkCallback = callbackData?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      // Payment Successful
      const items = CallbackMetadata.Item;
      const receiptNumber = items.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;

      await Payment.findOneAndUpdate(
        { checkoutRequestID: CheckoutRequestID },
        {
          $set: {
            status: 'Completed',
            mpesaReceiptNumber: receiptNumber,
          },
        }
      );
    } else {
      // Payment Failed or Cancelled by User
      await Payment.findOneAndUpdate(
        { checkoutRequestID: CheckoutRequestID },
        {
          $set: {
            status: 'Failed',
          },
        }
      );
    }
  } catch (error) {
    console.error('Error in M-Pesa callback:', error.message);
  }

  // Always respond to Safaricom with 200 OK
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = router;
