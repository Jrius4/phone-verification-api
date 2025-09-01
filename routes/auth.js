const express = require('express');
const {
  sendOtp,
  verifyOtp,
  resendOtp,
  verificationStatus,
  adminLogin,
  adminRegister,
  getProfile,
  updateProfile,
  changePassword,
  listUsers,
  deleteUser
} = require('../controllers/authController');

const {auth,requireAdmin,authRateLimit} = require('../middleware/auth');
const {
  validateRequest,
  phoneSchema,
  verifyOtpSchema
} = require('../middleware/validation');
const {
  otpRateLimit,
  verifyRateLimit,
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  ipRateLimit,
  failedAuthRateLimit
} = require('../middleware/rateLimit');


const router = express.Router();

router.use(ipRateLimit); // Apply IP-based rate limiting to all routes



// Admin authentication routes
router.post('/admin/login', loginRateLimit, adminLogin);
router.post('/admin/register', auth, requireAdmin,registerRateLimit, adminRegister);


// as admin get users route
router.get('/admin/users', auth, requireAdmin, listUsers);
router.get('/admin/users/:page/:limit', auth, requireAdmin, listUsers);
//delete user
router.delete('/admin/users/:id', auth, requireAdmin,deleteUser);

// Profile routes (protected)
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/change-password', auth,passwordResetRateLimit, changePassword);


// Send OTP endpoint
router.post('/send-otp', otpRateLimit, validateRequest(phoneSchema), sendOtp);

// Verify OTP endpoint
router.post('/verify-otp', verifyRateLimit, validateRequest(verifyOtpSchema), verifyOtp);

// Resend OTP endpoint
router.post('/resend-otp', otpRateLimit, validateRequest(phoneSchema), resendOtp);

// Verification status endpoint - FIXED parameter syntax
router.get('/verification-status/:phoneNumber', verificationStatus);

module.exports = router;