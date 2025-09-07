const { Schema: S3, model: M3, Types: T3 } = require('mongoose');
const Place = new S3({ name: String, address: String, lat: Number, lng: Number }, { _id: false });
const ProductLotSchema = new S3({
    farmerId: { type: T3.ObjectId, ref: 'User', required: true },
    produceType: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'Kg' },
    reservePrice: { type: Number, default: 0 },
    pickup: { type: Place, required: true },
    status: { type: String, enum: ['open', 'awarded', 'closed', 'cancelled'], default: 'open' },
    awardedBid: { type: T3.ObjectId, ref: 'ProductBid', default: null },
}, { timestamps: true });
ProductLotSchema.index({ status: 1, createdAt: -1 });
module.exports = M3('ProductLot', ProductLotSchema);