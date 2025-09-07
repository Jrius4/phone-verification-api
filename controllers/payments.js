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