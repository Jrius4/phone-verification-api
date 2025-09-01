const Joi = require('joi');

const phoneSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in E.164 format (e.g., +1234567890)'
    })
});

const verifyOtpSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required(),
  otp: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only digits'
    })
});

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    next();
  };
};

const driverRegistrationSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  surname: Joi.string().min(2).max(50).required(),
  businessAddress: Joi.string().min(5).max(200).required(),
  district: Joi.string().min(2).max(50).required(),
  country: Joi.string().min(2).max(50).default('Ghana'),
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required(),
  vehicleType: Joi.string()
    .valid('motorcycle','tricycle','pickup','van','truck','refrigerated truck','other')
    .required(),
  vehicleNumber: Joi.string()
    .pattern(/^[A-Z0-9\s-]+$/)
    .required(),
  driversLicenseNumber: Joi.string().min(5).max(20).required(),
  licenseExpiryDate: Joi.date().greater('now').required()
});

const driverUpdateSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  surname: Joi.string().min(2).max(50),
  businessAddress: Joi.string().min(5).max(200),
  district: Joi.string().min(2).max(50),
  country: Joi.string().min(2).max(50),
  vehicleType: Joi.string().valid('car', 'motorcycle', 'truck', 'van', 'bus', 'other'),
  vehicleNumber: Joi.string().pattern(/^[A-Z0-9\s-]+$/),
  driversLicenseNumber: Joi.string().min(5).max(20),
  licenseExpiryDate: Joi.date().greater('now'),
  status: Joi.string().valid('pending', 'active', 'deactivated', 'rejected')
});


const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const adminRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('admin', 'moderator', 'viewer').default('viewer')
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

module.exports = {
  validateRequest,
  phoneSchema,
  verifyOtpSchema,
    driverRegistrationSchema,
    driverUpdateSchema,
    adminLoginSchema,
    adminRegisterSchema,
    changePasswordSchema
};