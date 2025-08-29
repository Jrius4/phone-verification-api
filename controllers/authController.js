const jwt = require('jsonwebtoken');
const Otp = require('../models/VerifyPhoneNumberOtp');
const smsService = require('../services/smsService');

// Generate random 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const otp = generateOtp();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Check if there's an existing unexpired OTP
    const existingOtp = await Otp.findOne({ 
      phoneNumber, 
      expiresAt: { $gt: new Date() },
      isVerified: false
    });

    if (existingOtp) {
      return res.status(429).json({
        success: false,
        message: 'An active OTP already exists. Please wait or use the existing one.'
      });
    }

    // Send SMS
    const message = `Your OTP is ${otp}. It is valid for ${expiryMinutes} minutes.`;
    const smsResult = await smsService.sendSMS(phoneNumber, message);

    if (!smsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }

    // Save OTP to database
    const otpRecord = new Otp({
      phoneNumber,
      otp,
      expiresAt
    });

    await otpRecord.save();

    res.json({
      success: true,
      message: 'OTP sent successfully',
      // Include OTP in development for testing (remove in production)
      ...(process.env.NODE_ENV === 'development' && { debugOtp: otp })
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Cleanup expired OTPs
    await Otp.cleanupExpired();

    // Find the most recent OTP for this phone number
    const otpRecord = await Otp.findOne({ 
      phoneNumber,
      expiresAt: { $gt: new Date() },
      isVerified: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP found. Please request a new one.'
      });
    }

    // Check if exceeded max attempts
    if (otpRecord.attempts >= (parseInt(process.env.MAX_OTP_ATTEMPTS) || 3)) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    const isOtpValid = await otpRecord.compareOtp(otp);

    if (!isOtpValid) {
      // Increment attempt count
      await otpRecord.incrementAttempts();

      const attemptsLeft = (parseInt(process.env.MAX_OTP_ATTEMPTS) || 3) - otpRecord.attempts;

      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${attemptsLeft} attempt(s) left.`,
        attemptsLeft
      });
    }

    // Mark OTP as verified
    otpRecord.isVerified = true;
    await otpRecord.save();

    // Generate JWT token for verified phone number
    const token = jwt.sign(
      { phoneNumber, verified: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      token,
      phoneNumber
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Delete any existing OTPs for this number
    await Otp.deleteMany({ phoneNumber, isVerified: false });

    // Proceed with normal OTP sending
    const otp = generateOtp();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Send SMS
    const message = `Your new OTP is ${otp}. It is valid for ${expiryMinutes} minutes.`;
    const smsResult = await smsService.sendSMS(phoneNumber, message);

    if (!smsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }

    // Save new OTP
    const otpRecord = new Otp({
      phoneNumber,
      otp,
      expiresAt
    });

    await otpRecord.save();

    res.json({
      success: true,
      message: 'New OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { debugOtp: otp })
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.verificationStatus = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    const verifiedOtp = await Otp.findOne({
      phoneNumber,
      isVerified: true,
      expiresAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Verified within last 24 hours
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      isVerified: !!verifiedOtp,
      verifiedAt: verifiedOtp?.createdAt
    });

  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};