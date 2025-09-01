const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const driverSchema = new mongoose.Schema({
  // Registration Details
  registrationId: {
    type: String,
    unique: true,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'deactivated', 'rejected'],
    default: 'pending'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  
  // Personal Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  surname: {
    type: String,
    required: true,
    trim: true
  },
  
  // Contact Information
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    match: [/^\+[1-9]\d{1,14}$/, 'Please use valid E.164 format']
  },
  businessAddress: {
    type: String,
    required: true
  },
  district: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true,
    default: 'Ugsnda'
  },
  
  // Vehicle Information
  vehicleType: {
    type: String,
    required: true,
    enum: ['motorcycle','tricycle','pickup','van','truck','refrigerated truck','other']// vehicles use to transport farm produce
  },
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    match: [/^[A-Z0-9\s-]+$/, 'Please enter a valid vehicle number']
  },
  
  // License Information
  driversLicenseNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  licenseExpiryDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(date) {
        return date > new Date();
      },
      message: 'License must not be expired'
    }
  },
  
  // Verification
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  
  // Additional Fields
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalRides: {
    type: Number,
    default: 0
  },
  lastActive: Date,
  
  // Admin Fields
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: Date,
  rejectionReason: String
  
}, {
  timestamps: true
});

// Generate unique registration ID
driverSchema.pre('save', async function(next) {
//   if (this.isNew) {
//     const year = new Date().getFullYear().toString().slice(-2);
//     const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
//     // Count existing drivers to generate sequential ID registed this year current month
//     const count = await mongoose.model('Driver').countDocuments({
//       registrationId: new RegExp(`^FTY${year}${month}`)
//     });
//     this.registrationId = `FTY${year}${month}${(count + 1).toString().padStart(4, '0')}`;
//   }

if (this.isNew && !this.registrationId) {
    try {
      const year = new Date().getFullYear().toString().slice(-2);
      
      // Get the count of existing drivers to generate sequential ID
      const count = await mongoose.model('Driver').countDocuments();
      
      // Generate registration ID with proper padding
      this.registrationId = `FTY${year}${(count + 1).toString().padStart(6, '0')}`;
      
      // Verify the ID was set
      console.log('Generated registrationId:', this.registrationId);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

driverSchema.pre('validate', async function(next) {
  if (this.isNew && !this.registrationId) {
    try {
      // Fallback: Use UUID if sequential generation fails
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const count = await mongoose.model('Driver').countDocuments({
      registrationId: new RegExp(`^FTY${year}${month}`)
    });
    this.registrationId = `FTY${year}${month}${(count + 1).toString().padStart(4, '0')}`;
      console.log('Fallback registrationId generated:', this.registrationId);
    } catch (error) {
      // Ultimate fallback: timestamp-based ID
      const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const count = await mongoose.model('Driver').countDocuments({
      registrationId: new RegExp(`^FTY${year}${month}`)
    });
    this.registrationId = `FTY${year}${month}${(count + 1).toString().padStart(4, '0')}`;
    //   this.registrationId = `FTY-${Date.now().toString(36).toUpperCase()}`;
      console.log('Timestamp fallback registrationId:', this.registrationId);
    }
  }
  next();
});

// Indexes for better query performance
driverSchema.index({ registrationId: 1 });
driverSchema.index({ phoneNumber: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ district: 1 });
driverSchema.index({ rating: -1 });
driverSchema.index({ firstName: 1, surname: 1 });

module.exports = mongoose.model('Driver', driverSchema);