const { Schema, model, Types } = require('mongoose');


const PlaceSchema = new Schema({
    name: { type: String },
    address: { type: String },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
}, { _id: false });


const DeliveryRequestSchema = new Schema({
    buyerId: { type: Types.ObjectId, ref: 'Buyer', required: true },
    farmerId: { type: Types.ObjectId, ref: 'Farmer', required: true },
    produceType: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'Kg' },
    pickup: { type: PlaceSchema, required: true },
    dropoff: { type: PlaceSchema, required: true },
    notes: { type: String },
    status: { type: String, enum: ['open', 'awarded', 'cancelled', 'fulfilled'], default: 'open' },
    chosenQuote: { type: Types.ObjectId, ref: 'Quote', default: null },
    job: { type: Types.ObjectId, ref: 'DriverJob', default: null },
}, { timestamps: true });


DeliveryRequestSchema.index({ status: 1, createdAt: -1 });


module.exports = model('DeliveryRequest', DeliveryRequestSchema);