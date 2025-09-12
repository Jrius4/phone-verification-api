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

const { auth, requireAdmin, authRateLimit } = require('../middleware/auth');
const {
  validateRequest,
  phoneSchema,
  verifyOtpSchema,
} = require('../middleware/validation');
const Joi = require('joi');

const { signAuthToken } = require("./../utils/jwt")
const {
  otpRateLimit,
  verifyRateLimit,
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  ipRateLimit,
  failedAuthRateLimit
} = require('../middleware/rateLimit');
const VerifyPhoneNumberOtp = require('../models/VerifyPhoneNumberOtp');
const { sendOtpSms } = require('../utils/sms');
// Driver model
const Driver = require('../models/Driver');
const User = require('../models/User');
const Farmer = require('../models/Farmer');
const Buyer = require('../models/Buyer');

const e164 = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return s.replace(/\s+/g, '');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && digits[0] === '0') return `+256${digits.slice(1)}`;
  if (digits && !digits.startsWith('0')) return `+256${digits}`;
  return `+${digits}`;
};

const router = express.Router();

router.use(ipRateLimit); // Apply IP-based rate limiting to all routes

// Admin authentication routes
router.post('/admin/login', loginRateLimit, adminLogin);
router.post('/admin/register', auth, requireAdmin, registerRateLimit, adminRegister);


// as admin get users route
router.get('/admin/users', auth, requireAdmin, listUsers);
router.get('/admin/users/:page/:limit', auth, requireAdmin, listUsers);
//delete user
router.delete('/admin/users/:id', auth, requireAdmin, deleteUser);

// Profile routes (protected)
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/change-password', auth, passwordResetRateLimit, changePassword);


// Send OTP endpoint
router.post('/send-otp', otpRateLimit, validateRequest(phoneSchema), sendOtp);

// Verify OTP endpoint
router.post('/verify-otp', verifyRateLimit, validateRequest(verifyOtpSchema), verifyOtp);

// Resend OTP endpoint
router.post('/resend-otp', otpRateLimit, validateRequest(phoneSchema), resendOtp);

// Verification status endpoint - FIXED parameter syntax
router.get('/verification-status/:phoneNumber', verificationStatus);

// ----- DRIVER OTP START -----
router.post('/driver/start', validateRequest(phoneSchema), async (req, res) => {
  try {
    console.log(req);
    const {phoneNumber} = req.body;
    const to = e164(phoneNumber);


    const code = ('' + Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);


    // Upsert OTP record for this phone (replace existing unverified)
    await VerifyPhoneNumberOtp.deleteMany({ phoneNumber: to, isVerified: false });
    const rec = await VerifyPhoneNumberOtp.create({ phoneNumber: to, otp: code, expiresAt });


    const sender = process.env.OTP_SENDER_ID || 'FTY';
    await sendOtpSms({ to, body: `${sender} code: ${code}` });


    return res.json({ request_id: rec._id.toString() });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message || 'Bad request' });
  }
});

// ----- DRIVER OTP VERIFY -----
router.post('/driver/verify', async (req, res) => {
  try {
    const schema = Joi.object({ request_id: Joi.string().required(), code: Joi.string().length(6).required() });
    const { request_id, code } = await schema.validateAsync(req.body);

    const rec = await VerifyPhoneNumberOtp.findById(request_id);
    if (!rec) return res.status(400).json({ message: 'Invalid request' });
    if (rec.isOtpExpired()) return res.status(400).json({ message: 'Code expired' });
    if (rec.attempts >= 3) return res.status(400).json({ message: 'Too many attempts' });

    const ok = await rec.compareOtp(code);
    if (!ok) { await rec.incrementAttempts(); return res.status(400).json({ message: 'Invalid code' }); }

    rec.isVerified = true; await rec.save();
    // Ensure a Driver record exists for this phone (create minimal if needed)
    let driver = await Driver.findOne({ phoneNumber: rec.phoneNumber });
    if (!driver) {
      driver = await Driver.create({
        phoneNumber: rec.phoneNumber,
        firstName: 'Driver',
        surname: rec.phoneNumber.slice(-4),
        businessAddress: 'N/A', district: 'N/A', country: 'Uganda',
        vehicleType: 'motorcycle', vehicleNumber: `TMP-${Date.now()}`,
        driversLicenseNumber: `TMP-${Date.now()}`, licenseExpiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        isPhoneVerified: true,
      });
    }

    const token = signAuthToken({ sub: driver._id.toString(),phoneNumber: driver.phoneNumber, role: 'driver', subModel: 'Driver' });
    const userPayload = { id: driver._id, phoneNumber: driver.phoneNumber, firstName: driver.firstName, lastName: driver.surname };
    return res.json({ token, user: userPayload, role: 'driver' });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message || 'Bad request' });
  }
});
// ----- EMAIL + PASSWORD LOGIN (driver/farmer/buyer) -----
router.post('/:role(login|driver|farmer|buyer|user)/login', async (req, res) => {
  try {

    const myRole = req.params.role;
    if (myRole !== 'login' && !['driver', 'farmer', 'buyer','user'].includes(myRole)) return res.status(400).json({ message: 'Invalid role' });
    
    const role = req.params.role === 'login' ? (req.body.role || 'buyer') : req.params.role; // defensive
     console.log({role}); 
    const schema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(6).required() });
    const { email, password } = await schema.validateAsync(req.body);

   
    let userRole =null;
    switch (role) {
      case 'driver':
        userRole = await Driver.findOne({ email: email.toLowerCase() });
        break;
      case 'farmer':
        userRole = await Farmer.findOne({ email: email.toLowerCase() });
        break;
      case 'buyer':
        userRole = await Buyer.findOne({ email: email.toLowerCase() });
        break;
      default:
        userRole = await User.findOne({ email: email.toLowerCase() });
        break;
    }
    const user = userRole;
    console.log({userRole});
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });


    const token = signAuthToken({ sub: user._id.toString(), role, subModel: 'User' });
    return res.json({ token, user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName }, role });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message || 'Bad request' });
  }
});
// ----- PASSWORD RESET FLOW -----
router.post('/password/forgot', async (req, res) => {
  try {
    const schema = Joi.object({ role: Joi.string().valid('driver', 'farmer', 'buyer').required(), email: Joi.string().email().required() });
    const { role, email } = await schema.validateAsync(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: 'If account exists, an email was sent' });


    const token = signResetToken({ userId: user._id.toString() });
    console.log(`🔐 Password reset token for ${email}: ${token}`);
    return res.json({ message: 'If account exists, a reset link has been sent.' });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Bad request' });
  }
});

router.post('/password/reset', async (req, res) => {
  try {
    const schema = Joi.object({ token: Joi.string().required(), password: Joi.string().min(6).required(), password_confirmation: Joi.string().valid(Joi.ref('password')).required() });
    const { token, password } = await schema.validateAsync(req.body);


    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
    if (payload.action !== 'reset') throw new Error('Invalid token');


    const user = await User.findById(payload.sub);
    if (!user) throw new Error('User not found');
    user.password = password; await user.save();
    return res.json({ message: 'Password updated' });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Bad request' });
  }
});

module.exports = router;