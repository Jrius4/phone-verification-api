const rateLimit = require('express-rate-limit');

// Limit OTP requests to 3 per hour per IP
const otpRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limit OTP verification attempts to 5 per hour per IP
const verifyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  otpRateLimit,
  verifyRateLimit
};