const mongoose = require('mongoose');
const DriverJob = require('../models/DriverJob');

exports.listJobs = async (req, res) => {
  try {
    const { 
      q: search, 
      status, 
      commodity,
      sortBy = 'createdAt', 
      sortOrder = 'desc', 
      limit = 10, 
      page = 1 
    } = req.query;
    
    console.log({ search, status, commodity, sortBy, sortOrder, limit, page });
    
    // Build filter object
    const filter = { farmerId: req.user.sub };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Add commodity filter if provided
    if (commodity && commodity !== 'all') {
      filter.commodity = new RegExp(commodity, 'i');
    }
    
    // Build search query if provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { referenceNo: searchRegex },
        { buyer_name: searchRegex },
        { farmer_name: searchRegex },
        { commodity: searchRegex },
        { 'pickup_location.name': searchRegex },
        { 'pickup_location.address': searchRegex },
        { 'dropoff_location.name': searchRegex },
        { 'dropoff_location.address': searchRegex },
        { 'accepted_by.firstName': searchRegex },
        { 'accepted_by.surname': searchRegex },
        { 'accepted_by.vehicleNumber': searchRegex },
      ];
    }
    
    // Parse limit and page as numbers
    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const [rows, total] = await Promise.all([
      DriverJob.find(filter)
        .populate('accepted_by')
        .populate('buyerId')
        .populate('acceptedQuote')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      DriverJob.countDocuments(filter)
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    res.status(200).json({
      data: rows,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      }
    });
  } catch (e) {
    console.error('Error in listJobs:', e);
    res.status(500).json({ 
      message: e.message || "Internal server error",
      error: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}

exports.jobDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await DriverJob.findById(id)
      .populate('accepted_by')
      .populate('buyerId')
      .populate('acceptedQuote')
      .populate('farmerId')
      .populate('productLotId');
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    res.status(200).json({ job });
  } catch (e) {
    console.error('Error in jobDetails:', e);
    res.status(500).json({ 
      message: e.message || "Internal server error",
      error: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}

// Optional: Add endpoint to get available filters
exports.getFilters = async (req, res) => {
  try {
    const farmerId = req.user.sub;
    
    const [statusCounts, commodities] = await Promise.all([
      DriverJob.aggregate([
        { $match: { farmerId: mongoose.Types.ObjectId(farmerId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      DriverJob.distinct('commodity', { farmerId })
    ]);
    
    res.status(200).json({
      status: statusCounts,
      commodities: commodities.filter(c => c).sort() // Remove null/empty and sort
    });
  } catch (e) {
    console.error('Error in getFilters:', e);
    res.status(500).json({ 
      message: e.message || "Internal server error",
      error: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}
