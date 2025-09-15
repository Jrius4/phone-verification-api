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
   try{
     const schema = Joi3.object({ amount: Joi3.number().positive().required(), etaMinutes: Joi3.number().integer().positive().required(), note: Joi3.string().allow('', null) });
    const { amount, etaMinutes, note } = await schema.validateAsync(req.body);
    console.log({amount, etaMinutes, note});
  
    const request = await DeliveryRequest3.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'open') return res.status(400).json({ message: 'Request not open for quotes' });
    const existing = await Quote2.findOne({ driverId: req.user.sub, requestId: request._id, status: { $in: ['pending', 'accepted'] } });
    if (existing) return res.status(400).json({ message: 'You already have an active quote for this request' });
    const q = await Quote2.create({ requestId: request._id, driverId: req.user.sub, amount, etaMinutes, note });
    try { req.io?.emit('request:quote', { requestId: request._id.toString(), quoteId: q._id.toString(), driverId: req.user.sub }); } catch { }
    console.error({q});
    res.status(201).json({ quoteId: q._id });
   }catch(e){
        console.error({e});
        res.status(403).json({ message:e.message||"Something" });
   }
};

exports.getMyQuote = async (req, res) => {
    const q = await Quote2.findOne({ driverId: req.user.sub, requestId: req.params.id }).lean();
    if (!q) return res.status(404).json({ message: 'Not found' });
    res.json({ id: q._id, amount: q.amount, etaMinutes: q.etaMinutes, status: q.status, note: q.note, createdAt: q.createdAt });
};

exports.listMyQuotes = async (req, res) => {
    const status = (req.query.status || 'pending').toLowerCase();
    const rows = await Quote2.find({ driverId: req.user.sub, status }).populate('jobId').populate('driverId').populate('requestId').sort({ createdAt: -1 }).lean();
    console.log({rows});
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
    try{
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
    }catch(e){
        console.error('driver confirms',{e})
       res.status(403).json({ message:e.message||"Something",e });
    }
};
