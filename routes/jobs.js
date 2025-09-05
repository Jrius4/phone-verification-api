// routes/driverJobs.js
const express = require('express');
const DriverJob = require('../models/DriverJob');
const router = express.Router();

/** GET /api/driver/jobs?status=available */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const data = await DriverJob.find(query).sort({ createdAt: -1 }).lean();
    res.json({ data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/driver/jobs/active?driverId=DRIVER123 */
router.get('/active', async (req, res) => {
  try {
    const { driverId } = req.query;
    const q = { status: 'active' };
    if (driverId) q.driverId = driverId;
    const data = await DriverJob.find(q).sort({ updatedAt: -1 }).lean();
    res.json({ data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/driver/jobs  (create for testing) */
router.post('/', async (req, res) => {
  try {
    const job = await DriverJob.create(req.body || {});
    req.io?.emit?.('job:new', job);
    res.status(201).json(job);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /api/driver/jobs/:id/accept  { driverId } */
router.post('/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId = 'DRIVER_DEMO' } = req.body || {};
    const job = await DriverJob.findById(id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    if (job.status !== 'available') return res.status(409).json({ error: 'Job not available' });

    job.status = 'active';
    job.driverId = driverId;
    await job.save();

    req.io?.emit?.('job:accepted', { id: job.id, driverId });
    req.io?.emit?.('job:updated', job.toObject());
    res.json(job);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /api/driver/jobs/:id/complete */
router.post('/:id/complete', async (req, res) => {
  try {
    const job = await DriverJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    job.status = 'completed';
    await job.save();
    req.io?.emit?.('job:completed', { id: job.id });
    req.io?.emit?.('job:updated', job.toObject());
    res.json(job);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** DELETE /api/driver/jobs/:id */
router.delete('/:id', async (req, res) => {
  try {
    const job = await DriverJob.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    req.io?.emit?.('job:removed', { id: job.id });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
