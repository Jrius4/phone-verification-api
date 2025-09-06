const express2 = require('express');
const { auth, requireDriver,driverAuth } = require('../middleware/auth');
const DriverJob = require('../models/DriverJob');


const jobs = express2.Router();


// GET /api/driver/jobs?status=available|active|completed
jobs.get('/', auth, requireDriver, async (req, res) => {
    const status = (req.query.status || 'available').toLowerCase();
    const me = req.user;
    let query = {};
    if (status === 'available') query = { status: 'available' };
    else if (status === 'active') query = { status: { $in: ['accepted', 'active'] }, accepted_by: me.sub };
    else if (status === 'completed') query = { status: 'completed', accepted_by: me.sub };
    const rows = await DriverJob.find(query).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
});


// GET /api/driver/jobs/active
jobs.get('/active', auth, requireDriver, async (req, res) => {
    const rows = await DriverJob.find({ status: { $in: ['accepted', 'active'] }, accepted_by: req.user.sub }).sort({ createdAt: -1 }).lean();
    res.json({ data: rows });
});


// GET /api/driver/jobs/:id
jobs.get('/:id', auth, requireDriver, async (req, res) => {
    const row = await DriverJob.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
});


// POST /api/driver/jobs/:id/accept
jobs.post('/:id/accept', auth, requireDriver, async (req, res) => {
    const id = req.params.id;
    const me = req.user;
    const job = await DriverJob.findById(id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.status !== 'available') return res.status(400).json({ message: 'Job not available' });
    job.status = 'active';
    job.accepted_by = me.sub;
    job.accepted_at = new Date();
    await job.save();
    // broadcast removal from available lists
    try { req.io?.emit('job:awarded', { _id: job._id.toString(), status: job.status }); } catch { }
    res.json({ success: true, job });
});


// GET /api/driver/jobs/:id/tracking
jobs.get('/:id/tracking', auth, requireDriver, async (req, res) => {
    const job = await DriverJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: 'Not found' });
    res.json({ status: job.status, checkpoints: job.checkpoints || [] });
});

// NEW: POST /api/driver/jobs/:id/quote — driver submits a bid on an available job
jobs.post('/:id/quote', driverAuth, async (req, res) => {
    try {
        const { amount, etaMinutes, note } = req.body || {};
        if (!(amount > 0) || !(etaMinutes > 0)) return res.status(400).json({ message: 'Invalid amount or ETA' });


        const job = await DriverJob2.findById(req.params.id);
        if (!job) return res.status(404).json({ message: 'Job not found' });
        if (job.status !== 'available') return res.status(400).json({ message: 'Job is not open for quotes' });


        const q = await Quote2.create({ jobId: job._id, driverId: req.driver._id, amount, etaMinutes, note });
        res.status(201).json({ quoteId: q._id });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});


module.exports = jobs;


// // routes/driverJobs.js
// const express = require('express');
// const DriverJob = require('../models/DriverJob');
// const router = express.Router();

// /** GET /api/driver/jobs?status=available */
// router.get('/', async (req, res) => {
//   try {
//     const { status } = req.query;
//     const query = status ? { status } : {};
//     const data = await DriverJob.find(query).sort({ createdAt: -1 }).lean();
//     res.json({ data });
//   } catch (e) { res.status(500).json({ error: e.message }); }
// });

// /** GET /api/driver/jobs/active?driverId=DRIVER123 */
// router.get('/active', async (req, res) => {
//   try {
//     const { driverId } = req.query;
//     const q = { status: 'active' };
//     if (driverId) q.driverId = driverId;
//     const data = await DriverJob.find(q).sort({ updatedAt: -1 }).lean();
//     res.json({ data });
//   } catch (e) { res.status(500).json({ error: e.message }); }
// });

// /** POST /api/driver/jobs  (create for testing) */
// router.post('/', async (req, res) => {
//   try {
//     const job = await DriverJob.create(req.body || {});
//     req.io?.emit?.('job:new', job);
//     res.status(201).json(job);
//   } catch (e) { res.status(400).json({ error: e.message }); }
// });

// /** POST /api/driver/jobs/:id/accept  { driverId } */
// router.post('/:id/accept', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { driverId = 'DRIVER_DEMO' } = req.body || {};
//     const job = await DriverJob.findById(id);
//     if (!job) return res.status(404).json({ error: 'Not found' });
//     if (job.status !== 'available') return res.status(409).json({ error: 'Job not available' });

//     job.status = 'active';
//     job.driverId = driverId;
//     await job.save();

//     req.io?.emit?.('job:accepted', { id: job.id, driverId });
//     req.io?.emit?.('job:updated', job.toObject());
//     res.json(job);
//   } catch (e) { 
//     console.error({e,req,res});
//     res.status(400).json({ error: e.message }); }
// });

// /** POST /api/driver/jobs/:id/complete */
// router.post('/:id/complete', async (req, res) => {
//   try {
//     const job = await DriverJob.findById(req.params.id);
//     if (!job) return res.status(404).json({ error: 'Not found' });
//     job.status = 'completed';
//     await job.save();
//     req.io?.emit?.('job:completed', { id: job.id });
//     req.io?.emit?.('job:updated', job.toObject());
//     res.json(job);
//   } catch (e) { res.status(400).json({ error: e.message }); }
// });

// /** DELETE /api/driver/jobs/:id */
// router.delete('/:id', async (req, res) => {
//   try {
//     const job = await DriverJob.findByIdAndDelete(req.params.id);
//     if (!job) return res.status(404).json({ error: 'Not found' });
//     req.io?.emit?.('job:removed', { id: job.id });
//     res.json({ ok: true });
//   } catch (e) { res.status(400).json({ error: e.message }); }
// });

// module.exports = router;
