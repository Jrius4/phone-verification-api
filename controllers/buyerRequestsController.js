const Joi2 = require('joi');
const DeliveryRequest2 = require('../models/DeliveryRequest');
const Quote = require('../models/Quote');
const DriverJob = require('../models/DriverJob');
const PaymentIntent2 = require('../models/PaymentIntent');
const { PaymentService: PS } = require('../utils/payments');

exports.createRequest = async (req, res) => {
    const place = Joi2.object({ name: Joi2.string().allow('', null), address: Joi2.string().allow('', null), lat: Joi2.number().required(), lng: Joi2.number().required() });
    const schema = Joi2.object({ produceType: Joi2.string().required(), quantity: Joi2.number().positive().required(), unit: Joi2.string().valid('Kg', 'Bags', 'Crates', 'Litres', 'Tonnes').default('Kg'), pickup: place.required(), dropoff: place.required(), notes: Joi2.string().allow('', null) });
    const body = await schema.validateAsync(req.body);
    const doc = await DeliveryRequest2.create({ ...body, buyerId: req.user.sub });
    try { req.io?.emit('request:new', { requestId: doc._id.toString() }); } catch { }
    res.status(201).json({ id: doc._id, status: doc.status });
};

exports.getRequest = async (req, res) => {
    const doc = await DeliveryRequest2.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (String(doc.buyerId) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const qCount = await Quote.countDocuments({ requestId: doc._id, status: { $in: ['pending', 'accepted'] } });
    res.json({ ...doc, quotesCount: qCount });
};

exports.listQuotes = async (req, res) => {
    const doc = await DeliveryRequest2.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (String(doc.buyerId) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const quotes = await Quote.find({ requestId: doc._id, status: { $in: ['pending', 'accepted'] } }).populate('driverId', 'firstName surname phoneNumber rating vehicleType vehicleNumber').sort({ amount: 1, createdAt: 1 }).lean();
    res.json({ quotes });
};

exports.acceptQuote = async (req, res) => {
    const request = await DeliveryRequest2.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (String(request.buyerId) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    if (request.status !== 'open') return res.status(400).json({ message: 'Request is not open' });

    const quote = await Quote.findOne({ _id: req.params.qid || req.params.quoteId, requestId: request._id, status: 'pending' }).populate('driverId');
    if (!quote) return res.status(404).json({ message: 'Quote not found or not pending' });

    // Create job in awaiting_driver_confirm
    const job = await DriverJob.create({
        buyer_name: '', buyer_phone: '', farmer_name: '',
        commodity: request.produceType, weight_kg: request.unit.toLowerCase() === 'kg' ? request.quantity : undefined,
        payment_amount: quote.amount,
        pickup_location: request.pickup, dropoff_location: request.dropoff,
        instructions: request.notes || '',
        status: 'awaiting_driver_confirm',
        accepted_by: quote.driverId._id,
        accepted_at: new Date(),
        buyerId: request.buyerId,
        farmerId: request.pickupOwnerId || null,
        productLotId: request.lotId || null,
        farmerCode: String(Math.floor(1000 + Math.random() * 9000)),
        buyerCode: String(Math.floor(1000 + Math.random() * 9000)),
    });

    request.status = 'awarded'; await request.save();
    quote.status = 'accepted'; await quote.save();
    await Quote.updateMany({ requestId: request._id, _id: { $ne: quote._id }, status: 'pending' }, { $set: { status: 'rejected' } });

    // Authorize transport escrow for this job
    const provT = await PS.authorize({ job, buyer: req.user.sub });
    await PaymentIntent2.create({ jobId: job._id, buyerId: req.user.sub, driverId: quote.driverId._id, amount: quote.amount, status: 'authorized', provider: provT.provider, providerRef: provT.providerRef, type: 'transport' });

    try { req.io?.emit('quote:accepted', { requestId: request._id.toString(), driverId: quote.driverId._id.toString(), jobId: job._id.toString() }); } catch { }
    res.json({ jobId: job._id });
};