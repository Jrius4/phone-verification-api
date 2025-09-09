const { Schema: S4, model: M4, Types: T4 } = require('mongoose');
const ProductBidSchema = new S4({
    lotId: { type: T4.ObjectId, ref: 'ProductLot', required: true },
    buyerId: { type: T4.ObjectId, ref: 'Buyer', required: true },
    amount: { type: Number, required: true },
    quantity: { type: Number, required: true },
    units: String,
    note: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], default: 'pending' },
}, { timestamps: true });
ProductBidSchema.index({ lotId: 1, status: 1, createdAt: -1 });
module.exports = M4('ProductBid', ProductBidSchema);