const Joi3 = require('joi');
const DeliveryRequest3 = require('../models/DeliveryRequest');
const Quote2 = require('../models/Quote');

function haversine(a, b) { const d2r = Math.PI / 180, R = 6371e3; const dLat = (b.lat - a.lat) * d2r, dLng = (b.lng - a.lng) * d2r; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d2r) * Math.cos(b.lat * d2r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)); }

exports.openRequests = async (req, res) => {
  const nearLat = parseFloat(req.query.nearLat), nearLng = parseFloat(req.query.nearLng), withinKm = parseFloat(req.query.within_km || '50');
  const includeQuoted = String(req.query.includeQuoted || 'false').toLowerCase() === 'true';
  let rows = await DeliveryRequest3.find({ status: 'open' }).sort({ createdAt: -1 }).lean();
  if (!includeQuoted) {
    const mine = await Quote2.find({ driverId: req.user.sub, requestId: { $ne: null }, status: { $in: ['pending', 'accepted'] } }).select('requestId');
    const set = new Set(mine.map((q) => String(q.requestId))); rows = rows.filter((r) => !set.has(String(r._id)));
  }
  if (!Number.isNaN(nearLat) && !Number.isNaN(nearLng)) rows = rows.filter((r) => r?.pickup?.lat ? (haversine({ lat: nearLat, lng: nearLng }, { lat: r.pickup.lat, lng: r.pickup.lng }) <= withinKm * 1000) : true);
  res.json({ data: rows });
};

exports.submitQuote = async (req, res) => {
  try {
    const schema = Joi3.object({ amount: Joi3.number().positive().required(), etaMinutes: Joi3.number().integer().positive().required(), note: Joi3.string().allow('', null) });
    const { amount, etaMinutes, note } = await schema.validateAsync(req.body);
    console.log({ amount, etaMinutes, note });

    const request = await DeliveryRequest3.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'open') return res.status(400).json({ message: 'Request not open for quotes' });
    const existing = await Quote2.findOne({ driverId: req.user.sub, requestId: request._id, status: { $in: ['pending', 'accepted'] } });
    if (existing) return res.status(400).json({ message: 'You already have an active quote for this request' });
    const q = await Quote2.create({ requestId: request._id, driverId: req.user.sub, amount, etaMinutes, note });
    try { req.io?.emit('request:quote', { requestId: request._id.toString(), quoteId: q._id.toString(), driverId: req.user.sub }); } catch { }
    console.error({ q });
    res.status(201).json({ quoteId: q._id });
  } catch (e) {
    console.error({ e });
    res.status(403).json({ message: e.message || "Something" });
  }
};

exports.getMyQuote = async (req, res) => {
  const q = await Quote2.findOne({ driverId: req.user.sub, requestId: req.params.id }).lean();
  if (!q) return res.status(404).json({ message: 'Not found' });
  res.json({ id: q._id, amount: q.amount, etaMinutes: q.etaMinutes, status: q.status, note: q.note, createdAt: q.createdAt });
};

exports.listMyQuotes = async (req, res) => {
  try {
    const {
      q: search,
      status = 'all',
      commodity,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 10,
      page = 1
    } = req.query;

    // Build base filter
    const filter = { driverId: req.user.sub };

    // Add status filter if provided and not 'all'
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Parse pagination parameters
    const limitNum = Math.min(parseInt(limit, 10) || 10, 100); // Cap at 100 for safety
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // If search query is provided, use aggregation for better search across populated fields
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const aggregationPipeline = [
        // Match the base filter first
        { $match: filter },

        // Lookup to populate request details
        {
          $lookup: {
            from: 'deliveryrequests',
            localField: 'requestId',
            foreignField: '_id',
            as: 'requestDetails'
          }
        },
        { $unwind: { path: '$requestDetails', preserveNullAndEmptyArrays: true } },

        // Lookup to populate job details
        {
          $lookup: {
            from: 'driverjobs',
            localField: 'jobId',
            foreignField: '_id',
            as: 'jobDetails'
          }
        },
        { $unwind: { path: '$jobDetails', preserveNullAndEmptyArrays: true } },

        // Lookup to populate driver details (though we already have driverId filter)
        {
          $lookup: {
            from: 'drivers',
            localField: 'driverId',
            foreignField: '_id',
            as: 'driverDetails'
          }
        },
        { $unwind: { path: '$driverDetails', preserveNullAndEmptyArrays: true } },

        // Add commodity filter if provided
        ...(commodity && commodity !== 'all' ? [
          { $match: { 
            $or: [
              { 'requestDetails.produceType': new RegExp(commodity, 'i') },
              { 'jobDetails.commodity': new RegExp(commodity, 'i') }
            ]
          } }
        ] : []),

        // Add fields for searchable text
        {
          $addFields: {
            searchableText: {
              $concat: [
                { $ifNull: ['$note', ''] }, ' ',
                { $ifNull: ['$requestDetails.produceType', ''] }, ' ',
                { $ifNull: ['$jobDetails.referenceNo', ''] }, ' ',
                { $ifNull: ['$jobDetails.buyer_name', ''] }, ' ',
                { $ifNull: ['$jobDetails.farmer_name', ''] }, ' ',
                { $ifNull: ['$jobDetails.commodity', ''] }, ' ',
                { $ifNull: ['$jobDetails.pickup_location.address', ''] }, ' ',
                { $ifNull: ['$jobDetails.dropoff_location.address', ''] }, ' ',
                { $ifNull: ['$driverDetails.firstName', ''] }, ' ',
                { $ifNull: ['$driverDetails.surname', ''] }, ' ',
                { $ifNull: ['$driverDetails.phoneNumber', ''] }
              ]
            },
             // Add a separate field specifically for referenceNo for exact matching
      referenceNoText: { $ifNull: ['$jobDetails.referenceNo', ''] }
          }
        },

        // Match the search text
        {
           $match: {
      $or: [
        { searchableText: { $regex: searchRegex } },
        { referenceNoText: { $regex: searchRegex } } // Extra boost for referenceNo matches
      ]
    }
        },

        // Project to return the original document structure
        {
          $project: {
            searchableText: 0,
            requestDetails: 0,
             referenceNoText: 0,
            jobDetails: 0,
            driverDetails: 0
          }
        },

        // Sort
        { $sort: sort },

        // Pagination
        { $skip: skip },
        { $limit: limitNum }
      ];

      // Count pipeline (without pagination)
      const countPipeline = [
        ...aggregationPipeline.slice(0, -3), // Remove sort, skip, limit
        { $count: 'total' }
      ];

      const [rows, totalResult] = await Promise.all([
        Quote2.aggregate(aggregationPipeline),
        Quote2.aggregate(countPipeline)
      ]);

      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      // Populate the referenced documents for the results
      const populatedRows = await Quote2.populate(rows, [
        { 
          path: 'jobId', 
          populate: [
            { path: 'buyerId', select: 'firstName lastName phoneNumber' },
            { path: 'accepted_by', select: 'firstName surname phoneNumber vehicleType' }
          ] 
        },
        { 
          path: 'requestId', 
          populate: [
            { path: 'buyerId', select: 'firstName lastName phoneNumber' },
            { path: 'farmerId', select: 'firstName lastName' }
          ] 
        },
        { path: 'driverId', select: 'firstName surname phoneNumber vehicleType' }
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
    let query = Quote2.find(filter)
      .populate([
        { 
          path: 'jobId', 
          populate: [
            { path: 'buyerId', select: 'firstName lastName phoneNumber' },
            { path: 'accepted_by', select: 'firstName surname phoneNumber vehicleType' }
          ] 
        },
        { 
          path: 'requestId', 
          populate: [
            { path: 'buyerId', select: 'firstName lastName phoneNumber' },
            { path: 'farmerId', select: 'firstName lastName' }
          ] 
        },
        { path: 'driverId', select: 'firstName surname phoneNumber vehicleType' }
      ])
      .sort(sort);

    // Add commodity filter if provided (for non-search case)
    if (commodity && commodity !== 'all') {
      query = query.where({
        $or: [
          { 'jobId.commodity': new RegExp(commodity, 'i') },
          { 'requestId.produceType': new RegExp(commodity, 'i') }
        ]
      });
    }

    const [rows, total] = await Promise.all([
      query.skip(skip).limit(limitNum).lean(),
      Quote2.countDocuments(filter)
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
    console.error('Error in listMyQuotes:', e);
    res.status(500).json({
      message: e.message || "Internal server error",
      error: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
};

exports.withdrawQuote = async (req, res) => {
  const q = await Quote2.findOne({ _id: req.params.id, driverId: req.user.sub });
  if (!q) return res.status(404).json({ message: 'Not found' });
  if (q.status !== 'pending') return res.status(400).json({ message: 'Only pending quotes can be withdrawn' });
  q.status = 'withdrawn'; await q.save();
  res.json({ success: true });
};

exports.confirmAcceptedQuote = async (req, res) => {
  try {
    const Quote3 = require('../models/Quote'); const DriverJob3 = require('../models/DriverJob');
    const q = await Quote3.findById(req.params.id);
    if (!q || String(q.driverId) !== String(req.user.sub)) return res.status(404).json({ message: 'Quote not found' });
    if (q.status !== 'accepted') return res.status(400).json({ message: 'Quote not accepted by buyer' });
    const job = await DriverJob3.findOne({ accepted_by: q.driverId, payment_amount: q.amount, status: 'awaiting_driver_confirm' }).sort({ createdAt: -1 });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    job.status = 'active'; await job.save();
    q.status = 'active'; await q.save();
    try { req.io?.emit('job:active', { jobId: job._id.toString() }); } catch { }
    res.json({ success: true });
  } catch (e) {
    console.error('driver confirms', { e })
    res.status(403).json({ message: e.message || "Something", e });
  }
};
