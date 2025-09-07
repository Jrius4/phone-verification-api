// ============================================================================
// Farm‑To‑You (FTY) Express API — Full Workflow
// Models · Controllers · Routes (fits farmer→buyer→driver bidding + split escrow)
// ----------------------------------------------------------------------------
// Paste these files into your backend project. They extend what you already have
// (auth, OTP, users, driver) and complete the remaining workflows with clean
// controllers and routes.
//
// Requires: Express 4, Mongoose 8, JWT, Joi, Socket.IO
//
// Install (if missing):
//   npm i express joi jsonwebtoken bcryptjs mongoose twilio
//
// Mount in server.js (see bottom of this file for the snippet)
// ----------------------------------------------------------------------------

// =============================== models/User ================================
// (You already have User.js; ensure it exposes firstName, lastName, email,
//  comparePassword, and role (buyer|farmer|admin), etc.)

// ============================ models/DriverJob.js ===========================
// (UPDATED model with relational fields + codes for split escrow checkpoints)
const { Schema, model, Types } = require('mongoose');

const LocSchema = new Schema({ name: String, address: String, lat: Number, lng: Number }, { _id: false });

const DriverJobSchema = new Schema({
    // legacy/seeded fields
    buyer_name: String,
    buyer_phone: String,
    farmer_name: String,
    commodity: String,
    weight_kg: Number,
    payment_amount: Number, // transport price
    pickup_location: LocSchema,
    dropoff_location: LocSchema,
    instructions: String,

    // NEW relations
    buyerId: { type: Types.ObjectId, ref: 'User' },
    farmerId: { type: Types.ObjectId, ref: 'User' },
    productLotId: { type: Types.ObjectId, ref: 'ProductLot' },

    // Bidding lifecycle
    status: { type: String, enum: ['available', 'awaiting_driver_confirm', 'active', 'completed', 'cancelled'], default: 'available' },
    accepted_by: { type: Types.ObjectId, ref: 'Driver', default: null },
    accepted_at: Date,

    // Checkpoint codes
    farmerCode: String, // 4-digit code shown to farmer
    buyerCode: String,  // 4-digit code shown to buyer

    checkpoints: [{ lat: Number, lng: Number, ts: { type: Date, default: Date.now }, label: String }],
}, { timestamps: true });

DriverJobSchema.index({ status: 1, createdAt: -1 });
module.exports = model('DriverJob', DriverJobSchema);

// ============================ models/DeliveryRequest.js =====================
const { Schema: S1, model: M1, Types: T1 } = require('mongoose');
const PlaceSchema = new S1({ name: String, address: String, lat: Number, lng: Number }, { _id: false });
const DeliveryRequestSchema = new S1({
    buyerId: { type: T1.ObjectId, ref: 'User', required: true },
    produceType: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'Kg' },
    pickup: { type: PlaceSchema, required: true },
    dropoff: { type: PlaceSchema, required: true },
    notes: String,
    lotId: { type: T1.ObjectId, ref: 'ProductLot', default: null },
    pickupOwnerId: { type: T1.ObjectId, ref: 'User', default: null }, // farmer user if known
    status: { type: String, enum: ['open', 'awarded', 'cancelled', 'fulfilled'], default: 'open' },
}, { timestamps: true });
DeliveryRequestSchema.index({ status: 1, createdAt: -1 });
module.exports = M1('DeliveryRequest', DeliveryRequestSchema);

// =============================== models/Quote.js ============================
const { Schema: S2, model: M2, Types: T2 } = require('mongoose');
const QuoteSchema = new S2({
    requestId: { type: T2.ObjectId, ref: 'DeliveryRequest' },
    jobId: { type: T2.ObjectId, ref: 'DriverJob' }, // for seeded jobs path (optional)
    driverId: { type: T2.ObjectId, ref: 'Driver', required: true },
    amount: { type: Number, required: true }, // UGX
    etaMinutes: { type: Number, required: true },
    note: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], default: 'pending' },
}, { timestamps: true });
QuoteSchema.index({ requestId: 1, status: 1, createdAt: -1 });
module.exports = M2('Quote', QuoteSchema);

// ============================ models/ProductLot.js ==========================
const { Schema: S3, model: M3, Types: T3 } = require('mongoose');
const Place = new S3({ name: String, address: String, lat: Number, lng: Number }, { _id: false });
const ProductLotSchema = new S3({
    farmerId: { type: T3.ObjectId, ref: 'User', required: true },
    produceType: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'Kg' },
    reservePrice: { type: Number, default: 0 },
    pickup: { type: Place, required: true },
    status: { type: String, enum: ['open', 'awarded', 'closed', 'cancelled'], default: 'open' },
    awardedBid: { type: T3.ObjectId, ref: 'ProductBid', default: null },
}, { timestamps: true });
ProductLotSchema.index({ status: 1, createdAt: -1 });
module.exports = M3('ProductLot', ProductLotSchema);

// ============================ models/ProductBid.js ==========================
const { Schema: S4, model: M4, Types: T4 } = require('mongoose');
const ProductBidSchema = new S4({
    lotId: { type: T4.ObjectId, ref: 'ProductLot', required: true },
    buyerId: { type: T4.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    note: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], default: 'pending' },
}, { timestamps: true });
ProductBidSchema.index({ lotId: 1, status: 1, createdAt: -1 });
module.exports = M4('ProductBid', ProductBidSchema);

// ============================ models/PaymentIntent.js =======================
const { Schema: S5, model: M5, Types: T5 } = require('mongoose');
const PaymentIntentSchema = new S5({
    jobId: { type: T5.ObjectId, required: true }, // DriverJob _id for transport; ProductLot _id for product
    buyerId: { type: T5.ObjectId, ref: 'User', required: true },
    driverId: { type: T5.ObjectId, ref: 'Driver' }, // null for product escrow
    amount: { type: Number, required: true },
    currency: { type: String, default: 'UGX' },
    type: { type: String, enum: ['product', 'transport'], required: true },
    status: { type: String, enum: ['authorized', 'released', 'failed', 'cancelled'], default: 'authorized' },
    provider: { type: String, default: 'mock' },
    providerRef: { type: String },
}, { timestamps: true });
PaymentIntentSchema.index({ jobId: 1, type: 1 });
module.exports = M5('PaymentIntent', PaymentIntentSchema);

// =============================== models/DriverTag.js ========================
const { Schema: S6, model: M6, Types: T6 } = require('mongoose');
const DriverTagSchema = new S6({
    driverId: { type: T6.ObjectId, ref: 'Driver', required: true },
    tagId: { type: String, required: true, unique: true },
    ndefText: String,
    active: { type: Boolean, default: true },
}, { timestamps: true });
DriverTagSchema.index({ driverId: 1, tagId: 1 });
module.exports = M6('DriverTag', DriverTagSchema);

// ================================ utils/jwt.js ==============================
const jwt = require('jsonwebtoken');
module.exports.signAuthToken = ({ sub, role, subModel = 'User', expiresIn = '30d' }) => jwt.sign({ sub, role, subModel }, process.env.JWT_SECRET || 'dev', { expiresIn });

// ============================== utils/payments.js ===========================
module.exports.PaymentService = {
    async authorize({ job, buyer }) { return { provider: 'mock', providerRef: `pi_${(job?._id || 'x').toString()}` }; },
    async capture({ intent }) { return { ok: true, providerRef: intent.providerRef }; },
};

// ============================= middleware/auth.js ===========================
const jwt2 = require('jsonwebtoken');
function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try { req.user = jwt2.verify(token, process.env.JWT_SECRET || 'dev'); return next(); }
    catch { return res.status(401).json({ message: 'Invalid token' }); }
}
function requireRole(...roles) {
    return (req, res, next) => (!req.user || !roles.includes(req.user.role)) ? res.status(403).json({ message: 'Forbidden' }) : next();
}
function driverAuth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const p = jwt2.verify(token, process.env.JWT_SECRET || 'dev');
        if (p.role !== 'driver' && p.subModel !== 'Driver') return res.status(403).json({ message: 'Forbidden' });
        req.user = p; return next();
    } catch { return res.status(401).json({ message: 'Invalid token' }); }
}
module.exports = { auth, requireRole, driverAuth };

// ============================ controllers/products.js =======================
const Joi = require('joi');
const ProductLot = require('../models/ProductLot');
const ProductBid = require('../models/ProductBid');
const DeliveryRequest = require('../models/DeliveryRequest');
const PaymentIntent = require('../models/PaymentIntent');
const { PaymentService } = require('../utils/payments');

const placeSchema = Joi.object({ name: Joi.string().allow('', null), address: Joi.string().allow('', null), lat: Joi.number().required(), lng: Joi.number().required() });

exports.createLot = async (req, res) => {
    const schema = Joi.object({ produceType: Joi.string().required(), quantity: Joi.number().positive().required(), unit: Joi.string().valid('Kg', 'Bags', 'Crates', 'Litres', 'Tonnes').default('Kg'), reservePrice: Joi.number().min(0).default(0), pickup: placeSchema.required() });
    const body = await schema.validateAsync(req.body);
    const doc = await ProductLot.create({ ...body, farmerId: req.user.sub });
    try { req.io?.emit('product:new', { lotId: doc._id.toString() }); } catch { }
    res.status(201).json({ id: doc._id, status: doc.status });
};

exports.openLots = async (_req, res) => {
    const rows = await ProductLot.find({ status: 'open' }).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
};

exports.placeBid = async (req, res) => {
    const schema = Joi.object({ amount: Joi.number().positive().required(), note: Joi.string().allow('', null) });
    const { amount, note } = await schema.validateAsync(req.body);
    const lot = await ProductLot.findById(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (lot.status !== 'open') return res.status(400).json({ message: 'Lot not open' });
    const bid = await ProductBid.create({ lotId: lot._id, buyerId: req.user.sub, amount, note });
    try { req.io?.emit('product:bid', { lotId: lot._id.toString(), bidId: bid._id.toString() }); } catch { }
    res.status(201).json({ bidId: bid._id });
};

exports.listBids = async (req, res) => {
    const lot = await ProductLot.findById(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (String(lot.farmerId) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const bids = await ProductBid.find({ lotId: lot._id, status: { $in: ['pending', 'accepted'] } }).populate('buyerId', 'firstName lastName email').sort({ amount: -1 }).lean();
    res.json({ bids });
};

exports.acceptBid = async (req, res) => {
    const lot = await ProductLot.findById(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });
    if (String(lot.farmerId) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    if (lot.status !== 'open') return res.status(400).json({ message: 'Lot not open' });
    const bid = await ProductBid.findOne({ _id: req.params.bidId, lotId: lot._id, status: 'pending' }).populate('buyerId');
    if (!bid) return res.status(404).json({ message: 'Bid not found or not pending' });

    bid.status = 'accepted'; await bid.save();
    await ProductBid.updateMany({ lotId: lot._id, _id: { $ne: bid._id }, status: 'pending' }, { $set: { status: 'rejected' } });
    lot.status = 'awarded'; lot.awardedBid = bid._id; await lot.save();

    const prov = await PaymentService.authorize({ job: { _id: lot._id, payment_amount: bid.amount }, buyer: bid.buyerId._id });
    await PaymentIntent.create({ jobId: lot._id, buyerId: bid.buyerId._id, driverId: null, amount: bid.amount, status: 'authorized', provider: prov.provider, providerRef: prov.providerRef, type: 'product' });

    // Seed a DeliveryRequest for the buyer to broadcast (pickup = farm)
    const dr = await DeliveryRequest.create({
        buyerId: bid.buyerId._id,
        produceType: lot.produceType,
        quantity: lot.quantity,
        unit: lot.unit,
        pickup: lot.pickup,
        dropoff: { name: '', address: '', lat: 0, lng: 0 },
        notes: `From lot ${lot._id}`,
        lotId: lot._id,
        pickupOwnerId: lot.farmerId,
        status: 'open',
    });
    try { req.io?.emit('sale:accepted', { lotId: lot._id.toString(), buyerId: bid.buyerId._id.toString() }); } catch { }
    try { req.io?.emit('request:new', { requestId: dr._id.toString() }); } catch { }

    res.json({ requestId: dr._id });
};

// ========================== controllers/buyerRequests.js ====================
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

// ======================= controllers/driverRequests.js ======================
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
    const schema = Joi3.object({ amount: Joi3.number().positive().required(), etaMinutes: Joi3.number().integer().positive().required(), note: Joi3.string().allow('', null) });
    const { amount, etaMinutes, note } = await schema.validateAsync(req.body);
    const request = await DeliveryRequest3.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'open') return res.status(400).json({ message: 'Request not open for quotes' });
    const existing = await Quote2.findOne({ driverId: req.user.sub, requestId: request._id, status: { $in: ['pending', 'accepted'] } });
    if (existing) return res.status(400).json({ message: 'You already have an active quote for this request' });
    const q = await Quote2.create({ requestId: request._id, driverId: req.user.sub, amount, etaMinutes, note });
    try { req.io?.emit('request:quote', { requestId: request._id.toString(), quoteId: q._id.toString(), driverId: req.user.sub }); } catch { }
    res.status(201).json({ quoteId: q._id });
};

exports.getMyQuote = async (req, res) => {
    const q = await Quote2.findOne({ driverId: req.user.sub, requestId: req.params.id }).lean();
    if (!q) return res.status(404).json({ message: 'Not found' });
    res.json({ id: q._id, amount: q.amount, etaMinutes: q.etaMinutes, status: q.status, note: q.note, createdAt: q.createdAt });
};

exports.listMyQuotes = async (req, res) => {
    const status = (req.query.status || 'pending').toLowerCase();
    const rows = await Quote2.find({ driverId: req.user.sub, status }).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
};

exports.withdrawQuote = async (req, res) => {
    const q = await Quote2.findOne({ _id: req.params.id, driverId: req.user.sub });
    if (!q) return res.status(404).json({ message: 'Not found' });
    if (q.status !== 'pending') return res.status(400).json({ message: 'Only pending quotes can be withdrawn' });
    q.status = 'withdrawn'; await q.save();
    res.json({ success: true });
};

exports.confirmAcceptedQuote = async (req, res) => {
    const Quote3 = require('../models/Quote'); const DriverJob3 = require('../models/DriverJob');
    const q = await Quote3.findById(req.params.id);
    if (!q || String(q.driverId) !== String(req.user.sub)) return res.status(404).json({ message: 'Quote not found' });
    if (q.status !== 'accepted') return res.status(400).json({ message: 'Quote not accepted by buyer' });
    const job = await DriverJob3.findOne({ accepted_by: q.driverId, payment_amount: q.amount, status: 'awaiting_driver_confirm' }).sort({ createdAt: -1 });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    job.status = 'active'; await job.save();
    try { req.io?.emit('job:active', { jobId: job._id.toString() }); } catch { }
    res.json({ success: true });
};

// ============================== controllers/jobs.js =========================
const DriverJob4 = require('../models/DriverJob');
const PaymentIntent3 = require('../models/PaymentIntent');

exports.listDriverJobs = async (req, res) => {
    const status = (req.query.status || 'available').toLowerCase();
    const me = req.user;
    let query = {};
    if (status === 'available') query = { status: 'available' };
    else if (status === 'active') query = { status: { $in: ['accepted', 'active', 'awaiting_driver_confirm'] }, accepted_by: me.sub };
    else if (status === 'completed') query = { status: 'completed', accepted_by: me.sub };
    const rows = await DriverJob4.find(query).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
};

exports.getJob = async (req, res) => {
    const row = await DriverJob4.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
};

exports.acceptAvailableJob = async (req, res) => {
    const job = await DriverJob4.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.status !== 'available') return res.status(400).json({ message: 'Job not available' });
    job.status = 'active'; job.accepted_by = req.user.sub; job.accepted_at = new Date(); await job.save();
    try { req.io?.emit('job:awarded', { _id: job._id.toString(), status: job.status }); } catch { }
    res.json({ success: true, job });
};

exports.tracking = async (req, res) => {
    const job = await DriverJob4.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: 'Not found' });
    res.json({ status: job.status, checkpoints: job.checkpoints || [] });
};

exports.pickupConfirm = async (req, res) => {
    const job = await DriverJob4.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (String(job.accepted_by) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const code = String(req.body.code || '');
    if (code !== String(job.farmerCode)) return res.status(400).json({ message: 'Invalid farmer code' });
    const pi = await PaymentIntent3.findOne({ type: 'product', jobId: job.productLotId, status: 'authorized' });
    if (pi) { pi.status = 'released'; await pi.save(); }
    try { req.io?.emit('pickup:confirmed', { jobId: job._id.toString() }); } catch { }
    res.json({ success: true });
};

exports.deliveryConfirm = async (req, res) => {
    const job = await DriverJob4.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (String(job.accepted_by) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' });
    const code = String(req.body.code || '');
    if (code !== String(job.buyerCode)) return res.status(400).json({ message: 'Invalid buyer code' });
    const pi = await PaymentIntent3.findOne({ type: 'transport', jobId: job._id, status: 'authorized' });
    if (pi) { pi.status = 'released'; await pi.save(); }
    job.status = 'completed'; await job.save();
    try { req.io?.emit('job:completed', { jobId: job._id.toString() }); } catch { }
    res.json({ success: true });
};

// ============================ controllers/payments.js =======================
const Joi4 = require('joi');
const DriverJob5 = require('../models/DriverJob');
const PaymentIntent4 = require('../models/PaymentIntent');
const DriverTag = require('../models/DriverTag');
const { PaymentService: PaySvc } = require('../utils/payments');

exports.releaseTransportByNfc = async (req, res) => {
    const schema = Joi4.object({ tagId: Joi4.string().allow('', null), ndefText: Joi4.string().allow('', null) });
    const { tagId, ndefText } = await schema.validateAsync(req.body);
    const job = await DriverJob5.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.status !== 'active') return res.status(400).json({ message: 'Job not active' });
    const derived = tagId || (ndefText?.startsWith('fty:driver:') ? `NDEF:${ndefText.split(':').pop()}` : null);
    if (!derived) return res.status(400).json({ message: 'Missing tag info' });
    const tag = await DriverTag.findOne({ tagId: derived, active: true });
    if (!tag) return res.status(404).json({ message: 'Tag not registered' });
    if (String(tag.driverId) !== String(job.accepted_by)) return res.status(403).json({ message: 'Tag does not match driver' });
    const pi = await PaymentIntent4.findOne({ type: 'transport', jobId: job._id, status: 'authorized' });
    if (!pi) return res.status(400).json({ message: 'No authorized transport payment' });
    const cap = await PaySvc.capture({ intent: pi });
    if (!cap.ok) return res.status(502).json({ message: 'Payment capture failed' });
    pi.status = 'released'; await pi.save();
    job.status = 'completed'; await job.save();
    try { req.io?.emit('job:completed', { jobId: job._id.toString() }); } catch { }
    res.json({ success: true });
};

// =============================== controllers/nfc.js =========================
const Joi5 = require('joi');
const DriverTag2 = require('../models/DriverTag');
exports.listTags = async (req, res) => { const rows = await DriverTag2.find({ driverId: req.user.sub, active: true }).sort({ createdAt: -1 }).lean(); res.json({ tags: rows }); };
exports.registerTag = async (req, res) => {
    const { tagId, ndefText } = await Joi5.object({ tagId: Joi5.string().allow('', null), ndefText: Joi5.string().allow('', null) }).validateAsync(req.body);
    const derived = tagId || (ndefText?.startsWith('fty:driver:') ? `NDEF:${ndefText.split(':').pop()}` : null);
    if (!derived) return res.status(400).json({ message: 'Tag ID or valid NDEF text is required' });
    let doc = await DriverTag2.findOne({ tagId: derived });
    if (doc && String(doc.driverId) !== String(req.user.sub)) return res.status(409).json({ message: 'Tag already belongs to another driver' });
    if (!doc) doc = await DriverTag2.create({ driverId: req.user.sub, tagId: derived, ndefText });
    else { doc.active = true; doc.ndefText = ndefText || doc.ndefText; await doc.save(); }
    res.status(201).json({ tag: { id: doc._id, tagId: doc.tagId } });
};
exports.removeTag = async (req, res) => { const doc = await DriverTag2.findOne({ _id: req.params.id, driverId: req.user.sub }); if (!doc) return res.status(404).json({ message: 'Not found' }); doc.active = false; await doc.save(); res.json({ success: true }); };

// ================================= routes/products ==========================
const expressP = require('express');
const { auth: authMw, requireRole: rr } = require('../middleware/auth');
const pc = require('../controllers/products');
const productsRouter = expressP.Router();
productsRouter.post('/lots', authMw, rr('farmer'), pc.createLot);
productsRouter.get('/lots/open', pc.openLots);
productsRouter.post('/lots/:id/bids', authMw, rr('buyer'), pc.placeBid);
productsRouter.get('/lots/:id/bids', authMw, rr('farmer'), pc.listBids);
productsRouter.post('/lots/:id/bids/:bidId/accept', authMw, rr('farmer'), pc.acceptBid);
module.exports = productsRouter;

// ============================== routes/buyerRequests ========================
const expressB = require('express');
const { auth: authMw2 } = require('../middleware/auth');
const br = require('../controllers/buyerRequestsController');
const buyerRouter = expressB.Router();
buyerRouter.post('/', authMw2, br.createRequest);
buyerRouter.get('/:id', authMw2, br.getRequest);
buyerRouter.get('/:id/quotes', authMw2, br.listQuotes);
buyerRouter.post('/:id/quotes/:quoteId/accept', authMw2, br.acceptQuote);
module.exports = buyerRouter;

// ============================== routes/driverRequests =======================
const expressD = require('express');
const { driverAuth: dAuth } = require('../middleware/auth');
const dr = require('../controllers/driverRequests');
const driverReqRouter = expressD.Router();
driverReqRouter.get('/open', dAuth, dr.openRequests);
driverReqRouter.post('/:id/quote', dAuth, dr.submitQuote);
driverReqRouter.get('/:id/quotes/my', dAuth, dr.getMyQuote);
driverReqRouter.get('/quotes', dAuth, dr.listMyQuotes);
driverReqRouter.patch('/quotes/:id/withdraw', dAuth, dr.withdrawQuote);
driverReqRouter.post('/quotes/:id/confirm', dAuth, dr.confirmAcceptedQuote);
module.exports = driverReqRouter;

// ================================== routes/jobs ============================
const expressJ = require('express');
const { driverAuth: dAuth2 } = require('../middleware/auth');
const jobsCtrl = require('../controllers/jobs');
const jobsRouter = expressJ.Router();
jobsRouter.get('/', dAuth2, jobsCtrl.listDriverJobs);
jobsRouter.get('/:id', dAuth2, jobsCtrl.getJob);
jobsRouter.post('/:id/accept', dAuth2, jobsCtrl.acceptAvailableJob);
jobsRouter.get('/:id/tracking', dAuth2, jobsCtrl.tracking);
jobsRouter.post('/:id/pickup-confirm', dAuth2, jobsCtrl.pickupConfirm);
jobsRouter.post('/:id/delivery-confirm', dAuth2, jobsCtrl.deliveryConfirm);
module.exports = jobsRouter;

// ================================= routes/payments =========================
const expressPay = require('express');
const { auth: authMw3 } = require('../middleware/auth');
const pay = require('../controllers/payments');
const paymentsRouter = expressPay.Router();
paymentsRouter.post('/jobs/:jobId/release-nfc', authMw3, pay.releaseTransportByNfc);
module.exports = paymentsRouter;

// =================================== routes/nfc ============================
const expressN = require('express');
const { driverAuth: dAuth3 } = require('../middleware/auth');
const nfcCtrl = require('../controllers/nfc');
const nfcRouter = expressN.Router();
nfcRouter.get('/tags', dAuth3, nfcCtrl.listTags);
nfcRouter.post('/tags/register', dAuth3, nfcCtrl.registerTag);
nfcRouter.delete('/tags/:id', dAuth3, nfcCtrl.removeTag);
module.exports = nfcRouter;

// ================================= server wiring ===========================
/* Add in server.js (after you create app, http server, and io):

  const products = require('./routes/products');
  const buyerReqs = require('./routes/buyerRequests');
  const driverReqs = require('./routes/driverRequests');
  const jobs = require('./routes/jobs');
  const payments = require('./routes/payments');
  const nfc = require('./routes/nfc');

  // Make io available in req
  app.use((req, _res, next) => { req.io = io; next(); });

  app.use('/api/products', products);
  app.use('/api/buyer/requests', buyerReqs);
  app.use('/api/driver/requests', driverReqs);
  app.use('/api/driver/jobs', jobs);
  app.use('/api/payments', payments);
  app.use('/api/nfc', nfc);

*/

// ============================================================================
// End of bundle — Next step: I can generate API Docs (OpenAPI 3 / Markdown).
// ============================================================================
