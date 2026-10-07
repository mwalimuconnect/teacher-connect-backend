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
    const environment = process.env.MPESA_ENV || 'sandbox';

    if (!consumerKey || !consumerSecret) {
      console.error('Missing M-Pesa Consumer Key or Secret in Environment Variables');
      return res.status(500).json({ error: 'M-Pesa API credentials not configured.' });
    }

    const baseUrl =
      environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    req.accessToken = response.data.access_token;
    req.baseUrl = baseUrl;
    next();
  } catch (error) {
    console.error('Error generating access token:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to authenticate with M-Pesa' });
  }
};

// =========================================================================
// 1. POST Route: Trigger STK Push
// =========================================================================
router.post('/stkpush', getAccessToken, async (req, res) => {
  try {
    const { phone, phoneNumber, amount, price, accountReference, transactionDesc } = req.body;

    const rawPhone = phone || phoneNumber;
    const rawAmount = amount || price || 50;

    if (!rawPhone || !rawAmount) {
      return res.status(400).json({ error: 'Phone number and amount are required' });
    }

    // Format phone number to 254XXXXXXXXX
    let formattedPhone = String(rawPhone).trim().replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
      formattedPhone = '254' + formattedPhone;
    }

    const shortCode = process.env.MPESA_BUSINESS_SHORTCODE || process.env.MPESA_SHORTCODE || '174379';
    const passKey = process.env.MPESA_PASSKEY;
    
    if (!passKey) {
      console.error('Missing MPESA_PASSKEY in Environment Variables');
      return res.status(500).json({ error: 'M-Pesa Passkey is missing on backend server.' });
    }

    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortCode}${passKey}${timestamp}`).toString('base64');
    const stkPushUrl = `${req.baseUrl}/mpesa/stkpush/v1/processrequest`;

    const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://teacher-connect-backend.vercel.app/api/mpesa/callback';

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(rawAmount)),
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
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

// =========================================================================
// 2. POST Route: M-Pesa Callback Endpoint
// =========================================================================
router.post('/callback', (req, res) => {
  try {
    const callbackData = req.body;
    console.log('M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

    const stkCallback = callbackData?.Body?.stkCallback;
    const resultCode = stkCallback?.ResultCode;

    if (resultCode === 0) {
      const items = stkCallback?.CallbackMetadata?.Item || [];
      const receipt = items.find((item) => item.Name === 'MpesaReceiptNumber')?.Value;
      const amountPaid = items.find((item) => item.Name === 'Amount')?.Value;
      const phone = items.find((item) => item.Name === 'PhoneNumber')?.Value;

      console.log(`Payment Success: Receipt ${receipt}, Amount: KSh ${amountPaid}, Phone: ${phone}`);
    } else {
      console.log(`Payment Failed/Cancelled: ResultCode ${resultCode}`);
    }

    // Always respond to Safaricom with 200 OK to acknowledge receipt
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Callback parsing error:', error);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted with errors' });
  }
});

module.exports = router;
