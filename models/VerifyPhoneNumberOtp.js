const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const VerifyPhoneNumberOpt = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    attempts: {
        type: Number,
        default: 0,
        max: 3 // Maximum attempts allowed
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

// Hash the OTP before saving
VerifyPhoneNumberOpt.pre('save', async function(next) {
    if (!this.isModified('otp')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.otp = await bcrypt.hash(this.otp, salt);
    } catch (error) {
        return next(error);
    }
    next();
});

// Method to compare the provided OTP with the stored hashed OTP
VerifyPhoneNumberOpt.methods.compareOtp = async function(otp) {
    try {
        return await bcrypt.compare(otp, this.otp);
    } catch (error) {
        throw new Error('Error comparing OTP');
    }
};

// Method to check if otp is expired
VerifyPhoneNumberOpt.methods.isOtpExpired = function() {
    return this.expiresAt < new Date();
};

// Method to increment the attempts
VerifyPhoneNumberOpt.methods.incrementAttempts = function() {
    this.attempts += 1;
    return this.save();
};

// Static method to cleanup expired OTPs
VerifyPhoneNumberOpt.statics.cleanupExpired = async function() {
    const now = new Date();
    await this.deleteMany({ expiresAt: { $lt: now } });
};

// Create TTL index for automatic expiration
VerifyPhoneNumberOpt.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Export the model
module.exports = mongoose.model('VerifyPhoneNumberOtp', VerifyPhoneNumberOpt);