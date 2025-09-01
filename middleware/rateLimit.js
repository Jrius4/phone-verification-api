const rateLimit = require('express-rate-limit');




// Rate limiting function for auth endpoints
const createAuthRateLimit = (windowMinutes = 15, maxAttempts = 5) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxAttempts,
    message: {
      success: false,
      message: `Too many authentication attempts. Please try again in ${windowMinutes} minutes.`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: `Too many authentication attempts. Please try again in ${windowMinutes} minutes.`,
        retryAfter: Math.ceil(windowMinutes * 60)
      });
    }
  });
};

// Pre-configured rate limit instances (created at initialization)
const loginRateLimit = createAuthRateLimit(15, 5); // 5 attempts per 15 minutes
const registerRateLimit = createAuthRateLimit(60, 3); // 3 registrations per hour
const passwordResetRateLimit = createAuthRateLimit(30, 3); // 3 attempts per 30 minutes
const otpRateLimit = createAuthRateLimit(15, 5); // 5 OTP requests per 15 minutes
const verifyRateLimit = createAuthRateLimit(60, 10); // 10 verifications per hour

// More aggressive rate limiting for failed attempts
const failedAuthRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 failed attempts per hour
  message: {
    success: false,
    message: 'Too many failed authentication attempts. Account may be locked.'
  },
  skipSuccessfulRequests: true, // Only count failed attempts
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Account temporarily locked.',
      retryAfter: 3600
    });
  }
});

// IP-based rate limiting for general endpoints
const ipRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Driver-specific rate limits
const driverRegistrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 driver registrations per hour per IP
  message: {
    success: false,
    message: 'Too many driver registration attempts. Please try again later.'
  }
});

// Admin endpoints rate limits
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many admin requests. Please slow down.'
  }
});

module.exports = {
  otpRateLimit,
  verifyRateLimit,
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  failedAuthRateLimit,
  ipRateLimit,
  driverRegistrationRateLimit,
  adminRateLimit,
  // Default instances for common use cases
  defaultAuthRateLimit: createAuthRateLimit(15, 5),
  defaultAPIRateLimit: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.'
    }
  }),
};