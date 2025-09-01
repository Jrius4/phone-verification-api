const Driver = require('../models/Driver');
const Otp = require('../models/VerifyPhoneNumberOtp');
const jwt = require('jsonwebtoken');

// Register new driver with OTP verification
exports.registerDriver = async (req, res) => {
  try {
    const {
      firstName,
      surname,
      businessAddress,
      district,
      country,
      phoneNumber,
      vehicleType,
      vehicleNumber,
      driversLicenseNumber,
      licenseExpiryDate
    } = req.body;

    // Check if phone number is verified
    const verifiedOtp = await Otp.findOne({
      phoneNumber,
      isVerified: true,
      expiresAt: { $gt: new Date() }
    });

    if (!verifiedOtp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number not verified. Please verify your number first.'
      });
    }

    // Check if driver already exists with same phone, vehicle, or license
    const existingDriver = await Driver.findOne({
      $or: [
        { phoneNumber },
        { vehicleNumber: vehicleNumber.toUpperCase() },
        { driversLicenseNumber: driversLicenseNumber.toUpperCase() }
      ]
    });

    if (existingDriver) {
      return res.status(409).json({
        success: false,
        message: 'Driver with same phone number, vehicle number, or license already exists'
      });
    }

    // Create new driver
    const driver = new Driver({
      firstName,
      surname,
      businessAddress,
      district,
      country,
      phoneNumber,
      vehicleType,
      vehicleNumber: vehicleNumber.toUpperCase(),
      driversLicenseNumber: driversLicenseNumber.toUpperCase(),
      licenseExpiryDate,
      isPhoneVerified: true
    });

    await driver.save();

    // Mark OTP as used
    verifiedOtp.isVerified = false;
    await verifiedOtp.save();

    res.status(201).json({
      success: true,
      message: 'Driver registration submitted successfully',
      data: {
        registrationId: driver.registrationId,
        status: driver.status,
        driver: {
          firstName: driver.firstName,
          surname: driver.surname,
          phoneNumber: driver.phoneNumber
        }
      }
    });

  } catch (error) {
    console.error('Driver registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all drivers with pagination, search, and sorting
exports.getDrivers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      district,
      vehicleType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (district) filter.district = new RegExp(district, 'i');
    if (vehicleType) filter.vehicleType = vehicleType;
    
    // Search across multiple fields
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { surname: new RegExp(search, 'i') },
        { phoneNumber: new RegExp(search, 'i') },
        { vehicleNumber: new RegExp(search, 'i') },
        { registrationId: new RegExp(search, 'i') },
        { district: new RegExp(search, 'i') }
      ];
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const drivers = await Driver.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v -verificationToken')
      .lean();

    // Get total count for pagination
    const total = await Driver.countDocuments(filter);

    res.json({
      success: true,
      data: drivers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single driver by ID
exports.getDriver = async (req, res) => {
  try {
    const { id } = req.params;
    
    const driver = await Driver.findOne({
      $or: [
        { _id: id },
        { registrationId: id },
        { phoneNumber: id }
      ]
    }).select('-__v -verificationToken');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update driver
exports.updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const driver = await Driver.findOneAndUpdate(
      {
        $or: [
          { _id: id },
          { registrationId: id }
        ]
      },
      updates,
      { new: true, runValidators: true }
    ).select('-__v -verificationToken');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: driver
    });

  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete driver (soft delete by deactivating)
exports.deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findOneAndUpdate(
      {
        $or: [
          { _id: id },
          { registrationId: id }
        ]
      },
      { status: 'deactivated' },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      message: 'Driver deactivated successfully'
    });

  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Admin approval
exports.approveDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const driver = await Driver.findOneAndUpdate(
      {
        $or: [
          { _id: id },
          { registrationId: id }
        ],
        status: 'pending'
      },
      {
        status: 'active',
        approvedBy,
        approvalDate: new Date()
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found or already processed'
      });
    }

    res.json({
      success: true,
      message: 'Driver approved successfully',
      data: driver
    });

  } catch (error) {
    console.error('Approve driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get driver statistics
exports.getDriverStats = async (req, res) => {
  try {
    const stats = await Driver.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Driver.countDocuments();
    const active = await Driver.countDocuments({ status: 'active' });

    res.json({
      success: true,
      data: {
        byStatus: stats,
        total,
        active
      }
    });

  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};