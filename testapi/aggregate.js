// farmerRequestsController.js
const DriverJob = require('../models/DriverJob');
const mongoose = require('mongoose');

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
    
    // Parse limit and page as numbers
    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // If search query is provided, we need to handle it differently
    let searchFilter = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // First approach: Use aggregation with lookup for better search across populated fields
      const aggregationPipeline = [
        // Match the base filter first
        { $match: filter },
        
        // Lookup to populate buyer details
        {
          $lookup: {
            from: 'buyers', // assuming your Buyer collection is named 'buyers'
            localField: 'buyerId',
            foreignField: '_id',
            as: 'buyerDetails'
          }
        },
        { $unwind: { path: '$buyerDetails', preserveNullAndEmptyArrays: true } },
        
        // Lookup to populate driver details
        {
          $lookup: {
            from: 'drivers', // assuming your Driver collection is named 'drivers'
            localField: 'accepted_by',
            foreignField: '_id',
            as: 'driverDetails'
          }
        },
        { $unwind: { path: '$driverDetails', preserveNullAndEmptyArrays: true } },
        
        // Add fields for searchable text
        {
          $addFields: {
            searchableText: {
              $concat: [
                { $ifNull: ['$referenceNo', ''] }, ' ',
                { $ifNull: ['$buyer_name', ''] }, ' ',
                { $ifNull: ['$farmer_name', ''] }, ' ',
                { $ifNull: ['$commodity', ''] }, ' ',
                { $ifNull: ['$pickup_location.name', ''] }, ' ',
                { $ifNull: ['$pickup_location.address', ''] }, ' ',
                { $ifNull: ['$dropoff_location.name', ''] }, ' ',
                { $ifNull: ['$dropoff_location.address', ''] }, ' ',
                { $ifNull: ['$buyerDetails.firstName', ''] }, ' ',
                { $ifNull: ['$buyerDetails.lastName', ''] }, ' ',
                { $ifNull: ['$buyerDetails.phoneNumber', ''] }, ' ',
                { $ifNull: ['$driverDetails.firstName', ''] }, ' ',
                { $ifNull: ['$driverDetails.surname', ''] }, ' ',
                { $ifNull: ['$driverDetails.phoneNumber', ''] }
              ]
            }
          }
        },
        
        // Match the search text
        {
          $match: {
            searchableText: { $regex: searchRegex }
          }
        },
        
        // Project to return the original document structure
        {
          $project: {
            searchableText: 0,
            buyerDetails: 0,
            driverDetails: 0
          }
        },
        
        // Sort
        { $sort: sort },
        
        // Pagination
        { $skip: skip },
        { $limit: limitNum }
      ];
      
      // Count total matching documents
      const countPipeline = [
        ...aggregationPipeline.slice(0, -3), // Remove sort, skip, limit
        { $count: 'total' }
      ];
      
      const [rows, totalResult] = await Promise.all([
        DriverJob.aggregate(aggregationPipeline),
        DriverJob.aggregate(countPipeline)
      ]);
      
      const total = totalResult.length > 0 ? totalResult[0].total : 0;
      
      // Populate the referenced documents for the results
      const populatedRows = await DriverJob.populate(rows, [
        { path: 'accepted_by' },
        { path: 'buyerId' },
        { path: 'acceptedQuote' }
      ]);
      
      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;
      
      return res.status(200).json({
        data: populatedRows,
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
    }
    
    // If no search query, use the simpler approach
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

// Alternative simpler approach if aggregation is too complex
exports.listJobsSimple = async (req, res) => {
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
    
    // Parse limit and page as numbers
    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // First get all jobs with basic filtering
    let query = DriverJob.find(filter)
      .populate('accepted_by')
      .populate('buyerId')
      .populate('acceptedQuote')
      .sort(sort);
    
    // If search query is provided, filter after population
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // Execute query without search first
      const allJobs = await query.lean();
      
      // Filter in JavaScript (less efficient but simpler)
      const filteredJobs = allJobs.filter(job => {
        const searchText = [
          job.referenceNo,
          job.buyer_name,
          job.farmer_name,
          job.commodity,
          job.pickup_location?.name,
          job.pickup_location?.address,
          job.dropoff_location?.name,
          job.dropoff_location?.address,
          job.buyerId?.firstName,
          job.buyerId?.lastName,
          job.buyerId?.phoneNumber,
          job.accepted_by?.firstName,
          job.accepted_by?.surname,
          job.accepted_by?.phoneNumber
        ].join(' ').toLowerCase();
        
        return searchRegex.test(searchText);
      });
      
      // Apply pagination manually
      const paginatedJobs = filteredJobs.slice(skip, skip + limitNum);
      const total = filteredJobs.length;
      
      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;
      
      return res.status(200).json({
        data: paginatedJobs,
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
    }
    
    // If no search query, use normal pagination
    const [rows, total] = await Promise.all([
      query.skip(skip).limit(limitNum).lean(),
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
    console.error('Error in listJobsSimple:', e);
    res.status(500).json({ 
      message: e.message || "Internal server error",
      error: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}