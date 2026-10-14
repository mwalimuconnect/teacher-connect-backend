const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// POST /api/verify-tsc
router.post('/', async (req, res) => {
  const { idNumber, tscNumber } = req.body;

  if (!idNumber || !tscNumber) {
    return res.status(400).json({
      success: false,
      message: 'Both National ID and TSC Number are required for verification.',
    });
  }

  try {
    const response = await axios.post(
      'https://tsconline.tsc.go.ke/register/registration-status',
      new URLSearchParams({
        id_no: idNumber.trim(),
      }),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const $ = cheerio.load(response.data);
    const bodyText = $('body').text().toUpperCase();
    const cleanTsc = tscNumber.trim().toUpperCase();

    const isRegistered = bodyText.includes('REGISTERED') || bodyText.includes('VERIFIED');
    const matchesTsc = bodyText.includes(cleanTsc);

    if (isRegistered || matchesTsc) {
      return res.status(200).json({
        success: true,
        verified: true,
        message: 'TSC details verified successfully against official records.',
      });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'TSC or ID Number record not found in official registered database.',
      });
    }
  } catch (error) {
    console.error('TSC Verification Scraping Error:', error.message);
    
    return res.status(200).json({
      success: true,
      verified: false,
      isFallback: true,
      message: 'TSC portal server unresponsive. Submitted for manual review.',
    });
  }
});

module.exports = router;
