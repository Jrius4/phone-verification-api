const Joi5 = require('joi');
const DriverTag2 = require('../models/DriverTag');
exports.listTags = async (req, res) => { const rows = await DriverTag2.find({ driverId: req.user.sub, active: true }).sort({ createdAt: -1 }).lean(); res.json({ tags: rows }); };
exports.registerTag = async (req, res) => {
   try{
     const { tagId, ndefText } = await Joi5.object({ tagId: Joi5.string().allow('', null), ndefText: Joi5.string().allow('', null) }).validateAsync(req.body);
    const derived = tagId || (ndefText?.startsWith('fty:driver:') ? `NDEF:${ndefText.split(':').pop()}` : null);
    if (!derived) return res.status(400).json({ message: 'Tag ID or valid NDEF text is required' });
    let doc = await DriverTag2.findOne({ tagId: derived });
    if (doc && String(doc.driverId) !== String(req.user.sub)) return res.status(409).json({ message: 'Tag already belongs to another driver' });
    if (!doc) doc = await DriverTag2.create({ driverId: req.user.sub, tagId: derived, ndefText });
    else { doc.active = true; doc.ndefText = ndefText || doc.ndefText; await doc.save(); }
    res.status(201).json({ tag: { id: doc._id, tagId: doc.tagId } });
   }catch(e){
    res.status(500).json({success:false,message:e.message || 'Something Happened'});
   }
};
exports.removeTag = async (req, res) => { const doc = await DriverTag2.findOne({ _id: req.params.id, driverId: req.user.sub }); if (!doc) return res.status(404).json({ message: 'Not found' }); doc.active = false; await doc.save(); res.json({ success: true }); };
