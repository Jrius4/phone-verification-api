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