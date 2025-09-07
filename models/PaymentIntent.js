const { Schema: S5, model: M5, Types: T5 } = require('mongoose');
const PaymentIntentSchema = new S5({
    jobId: { type: T5.ObjectId, required: true }, // DriverJob _id for transport; ProductLot _id for product
    buyerId: { type: T5.ObjectId, ref: 'Buyer', required: true },
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