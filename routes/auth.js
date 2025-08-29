const express = require('express');
const {
  sendOtp,
  verifyOtp,
  resendOtp,
  verificationStatus
} = require('../controllers/authController');
const {
  validateRequest,
  phoneSchema,
  verifyOtpSchema
} = require('../middleware/validation');
const {
  otpRateLimit,
  verifyRateLimit
} = require('../middleware/rateLimit');

const router = express.Router();

router.post('/send-otp', otpRateLimit, validateRequest(phoneSchema), sendOtp);
router.post('/verify-otp', verifyRateLimit, validateRequest(verifyOtpSchema), verifyOtp);
router.post('/resend-otp', otpRateLimit, validateRequest(phoneSchema), resendOtp);
router.get('/verification-status/:phoneNumber', verificationStatus);

module.exports = router;