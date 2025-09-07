const { Schema: S, model: M, Types: T } = require('mongoose');


const QuoteSchema = new S({
    requestId: { type: T.ObjectId, ref: 'DeliveryRequest' }, // for buyer requests
    jobId: { type: T.ObjectId, ref: 'DriverJob' }, // for quoting on seeded jobs (optional)
    driverId: { type: T.ObjectId, ref: 'Driver', required: true },
    amount: { type: Number, required: true }, // UGX
    currency:{ type: String, default: 'UGX' },
    etaMinutes: { type: Number, required: true },
    note: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], default: 'pending' },
}, { timestamps: true });


QuoteSchema.index({ requestId: 1, status: 1, createdAt: -1 });
QuoteSchema.index({ jobId: 1, status: 1, createdAt: -1 });


module.exports = M('Quote', QuoteSchema);