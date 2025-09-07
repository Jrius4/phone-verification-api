// models/DriverJob.js
const { Schema, model, Types } = require('mongoose');

const LocationSchema = new Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  name: { type: String },
  address: String,
}, { _id: false });

const DriverJobSchema = new Schema({
  referenceNo: {
    type: String,
    unique: true,
    required: true
  },
  buyer_name: { type: String, required: true },
  buyer_phone: { type: String, required: false },
  farmer_name: { type: String, required: true },
  commodity: { type: String, required: true },
  weight_kg: { type: Number },
  payment_amount: { type: Number, required: false },
  pickup_location: { type: LocationSchema, required: true },
  dropoff_location: { type: LocationSchema, required: true },
  instructions: { type: String },
  status: { type: String, enum: ['available', 'awaiting_driver_confirm', 'active', 'completed', 'cancelled'], default: 'available' },
  // NEW relations
  buyerId: { type: Types.ObjectId, ref: 'Buyer' },
  farmerId: { type: Types.ObjectId, ref: 'Farmer' },
  productLotId: { type: Types.ObjectId, ref: 'ProductLot' },
  accepted_by: { type: Types.ObjectId, ref: 'Driver', default: null },
   accepted_at: Date,

    // Checkpoint codes
    farmerCode: String, // 4-digit code shown to farmer
    buyerCode: String,  // 4-digit code shown to buyer

    checkpoints: [{ lat: Number, lng: Number, ts: { type: Date, default: Date.now }, label: String }],
}, { timestamps: true });



// Generate unique registration ID
DriverJobSchema.pre('save', async function (next) {


  if (this.isNew && !this.referenceNo) {
    try {
      const year = new Date().getFullYear().toString().slice(-2);

      // Get the count of existing drivers to generate sequential ID
      const count = await model('Driver').countDocuments();

      // Generate registration ID with proper padding
      this.referenceNo = `FTY${year}${(count + 1).toString().padStart(6, '0')}`;

      // Verify the ID was set
      console.log('Generated referenceNo:', this.referenceNo);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

DriverJobSchema.pre('validate', async function (next) {
  if (this.isNew && !this.referenceNo) {
    try {
      // Fallback: Use UUID if sequential generation fails
      const year = new Date().getFullYear().toString().slice(-2);
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const count = await model('DriverJob').countDocuments({
        referenceNo: new RegExp(`^FTYJB${year}${month}`)
      });
      this.referenceNo = `FTYJB${year}${month}${(count + 1).toString().padStart(4, '0')}`;
      console.log('Fallback referenceNo generated:', this.referenceNo);
    } catch (error) {
      // Ultimate fallback: timestamp-based ID
      const year = new Date().getFullYear().toString().slice(-2);
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const count = await model('DriverJob').countDocuments({
        referenceNo: new RegExp(`^FTYJB${year}${month}`)
      });
      this.referenceNo = `FTYJB${year}${month}${(count + 1).toString().padStart(4, '0')}`;
      //   this.referenceNo = `FTYJB-${Date.now().toString(36).toUpperCase()}`;
      console.log('Timestamp fallback referenceNo:', this.referenceNo);
    }
  }
  next();
});
DriverJobSchema.index({ status: 1, createdAt: -1 });
module.exports = model('DriverJob', DriverJobSchema);
