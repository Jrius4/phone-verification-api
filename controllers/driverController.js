const Driver = require('../models/Driver');
const Otp = require('../models/VerifyPhoneNumberOtp');
const jwt = require('jsonwebtoken');
const DeliveryRequest = require('../models/DeliveryRequest');
const Quote = require('../models/Quote');



exports.getDeliveryRequests = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { driverId: req.user.id };
  if (status) filter.status = status;
  const requests = await DeliveryRequest.find(filter)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });
  const total = await DeliveryRequest.countDocuments(filter);
  res.json({
    success: true,
    data: requests,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalRequests: total
  });
}

exports.getAllDeliveryRequests = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const requests = await DeliveryRequest.find()
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });
  const total = await DeliveryRequest.countDocuments(filter);
  res.json({
    success: true,
    data: requests,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalRequests: total
  });
}


exports.saveDeliverRequest = async (req, res) => {
  try {
    const payload = req.body;
    const doc = await DeliveryRequest.create({ ...payload, buyerId: req.user._id });
    res.status(201).json({ id: doc._id, status: doc.status });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

exports.singleDeliverRequest = async (req, res) => {
  const doc = await DeliveryRequest.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ message: 'Not found' });
  if (String(doc.buyerId) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  const qCount = await Quote.countDocuments({ requestId: doc._id, status: { $in: ['pending', 'accepted'] } });
  res.json({ ...doc, quotesCount: qCount });
}

exports.getQuotesDeliverRequest = async (req, res) => {
  const doc = await DeliveryRequest.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ message: 'Not found' });
  if (String(doc.buyerId) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  const quotes = await Quote.find({ requestId: doc._id, status: { $in: ['pending', 'accepted'] } })
    .populate('driverId', 'firstName surname phoneNumber rating')
    .sort({ amount: 1, createdAt: 1 })
    .lean();
  res.json({ quotes });
}



exports.saveAcceptedQuote = async (req, res) => {
  const request = await DeliveryRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (String(request.buyerId) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
  if (request.status !== 'open') return res.status(400).json({ message: 'Request is not open' });


  const quote = await Quote.findOne({ _id: req.params.qid, requestId: request._id, status: 'pending' }).populate('driverId');
  if (!quote) return res.status(404).json({ message: 'Quote not found or not pending' });


  // Create a DriverJob from the request + accepted quote
  const job = await DriverJob.create({
    buyer_name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
    buyer_phone: req.user.phone || '',
    farmer_name: request.pickup?.name || 'Farmer',
    commodity: request.produceType,
    weight_kg: request.unit?.toLowerCase() === 'kg' ? request.quantity : undefined,
    payment_amount: quote.amount,
    pickup_location: {
      name: request.pickup?.name, address: request.pickup?.address,
      lat: request.pickup.lat, lng: request.pickup.lng,
    },
    dropoff_location: {
      name: request.dropoff?.name, address: request.dropoff?.address,
      lat: request.dropoff.lat, lng: request.dropoff.lng,
    },
    instructions: request.notes || '',
    status: 'active',
    accepted_by: quote.driverId._id,
    accepted_at: new Date(),
  });


  // Update request + quotes
  request.status = 'awarded';
  request.chosenQuote = quote._id;
  request.job = job._id;
  await request.save();


  quote.status = 'accepted';
  await quote.save();
  await Quote.updateMany({ requestId: request._id, _id: { $ne: quote._id }, status: 'pending' }, { $set: { status: 'rejected' } });


  // Notify drivers
  try { req.io?.emit('job:awarded', { _id: job._id.toString(), requestId: request._id.toString(), driverId: quote.driverId._id.toString() }); } catch { }


  res.json({ jobId: job._id });
}

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

exports.me = async (req, res) => {
  const me = await DriverModel.findById(req.user.sub).lean();
  if (!me) return res.status(404).json({ message: 'Not found' });
  res.json({ id: me._id, firstName: me.firstName, surname: me.surname, phoneNumber: me.phoneNumber, rating: me.rating });
}
