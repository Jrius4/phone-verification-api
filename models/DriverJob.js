// models/DriverJob.js
const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  name: { type: String }
}, { _id: false });

const DriverJobSchema = new mongoose.Schema({
  buyer_name: { type: String, required: true },
  buyer_phone: { type: String, required: true },
  farmer_name: { type: String, required: true },
  commodity: { type: String, required: true },
  weight_kg: { type: Number },
  payment_amount: { type: Number, required: true },
  pickup_location: { type: LocationSchema, required: true },
  dropoff_location: { type: LocationSchema, required: true },
  instructions: { type: String },
  status: { type: String, enum: ['available', 'active', 'completed'], default: 'available' },
  driverId: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('DriverJob', DriverJobSchema);
