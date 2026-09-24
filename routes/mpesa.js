const express = require('express');
const axios = require('axios');
const router = express.Router();

// Helper: Generate Daraja Timestamp (YYYYMMDDHHmmss)
const getTimestamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Middleware: Fetch OAuth Access Token from Safaricom
const getAccessToken = async (req, res, next) => {
  try {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    req.accessToken = response.data.access_token;
    next();
  } catch (error) {
    console.error('Error generating access token:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to authenticate with M-Pesa' });
  }
};

// POST Route: Trigger STK Push
router.post('/stkpush', getAccessToken, async (req, res) => {
  try {
    const { phone, amount, accountReference, transactionDesc } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required' });
    }

    // Format phone number to 2547XXXXXXXX
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = `254${formattedPhone.slice(1)}`;
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.slice(1);
    }

    const shortCode = process.env.MPESA_BUSINESS_SHORTCODE;
    const passKey = process.env.MPESA_PASSKEY;
    const timestamp = getTimestamp();

    const password = Buffer.from(`${shortCode}${passKey}${timestamp}`).toString('base64');
    const stkPushUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(amount)),
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountReference || 'ResourceDownload',
      TransactionDesc: transactionDesc || 'Payment',
    };

    const response = await axios.post(stkPushUrl, payload, {
      headers: {
        Authorization: `Bearer ${req.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'STK Push prompt sent to phone',
      data: response.data,
    });
  } catch (error) {
    console.error('Error triggering STK Push:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'STK Push initiation failed',
      details: error.response?.data || error.message,
    });
  }
});

// POST Route: M-Pesa Callback Endpoint
router.post('/callback', (req, res) => {
  const callbackData = req.body;
  console.log('M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

  const resultCode = callbackData?.Body?.stkCallback?.ResultCode;

  if (resultCode === 0) {
    const items = callbackData.Body.stkCallback.CallbackMetadata.Item;
    const receipt = items.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
    const amountPaid = items.find((item) => item.Name === 'Amount')?.Value;

    console.log(`Payment Success: Receipt ${receipt}, Amount: ${amountPaid}`);
  } else {
    console.log(`Payment Failed/Cancelled: ResultCode ${resultCode}`);
  }

  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = router;
