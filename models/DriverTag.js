const { Schema: S6, model: M6, Types: T6 } = require('mongoose');
const DriverTagSchema = new S6({
    driverId: { type: T6.ObjectId, ref: 'Driver', required: true },
    tagId: { type: String, required: true, unique: true },
    ndefText: String,
    active: { type: Boolean, default: true },
}, { timestamps: true });
DriverTagSchema.index({ driverId: 1, tagId: 1 });
module.exports = M6('DriverTag', DriverTagSchema);