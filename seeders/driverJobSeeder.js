// seeders/driverJobSeeder.js
const mongoose = require('mongoose');
require('dotenv').config();
const readline = require('readline');
const DriverJob = require('../models/DriverJob');

// Kampala-ish coordinates and sample data (matches your earlier seed)
const KLA = { lat: 0.3476, lng: 32.5825 };
const areas = [
  { name: 'Nakasero Market', lat: 0.3225, lng: 32.5760 },
  { name: 'Nakawa Market',   lat: 0.3321, lng: 32.6140 },
  { name: 'Wandegeya',       lat: 0.3392, lng: 32.5685 },
  { name: 'Kalerwe',         lat: 0.3749, lng: 32.5718 },
  { name: 'Kireka',          lat: 0.3486, lng: 32.6637 },
];
const commodities = ['Maize', 'Beans', 'Matooke', 'Coffee', 'Groundnuts'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (min, max) => +(Math.random() * (max - min) + min).toFixed(5);

function makeJob(i) {
  const a = pick(areas);
  const drop = { name: 'Buyer Warehouse', lat: KLA.lat + rnd(-0.02, 0.02), lng: KLA.lng + rnd(-0.02, 0.02) };
  const commodity = pick(commodities);
  const weight = pick([50, 80, 100, 150, 200]);
  const pay = pick([25000, 30000, 35000, 40000, 50000]);
  return {
    buyer_name: `Buyer ${i + 1}`,
    buyer_phone: `+25670${Math.floor(1000000 + Math.random() * 8999999)}`,
    farmer_name: `Farmer ${i + 1}`,
    commodity,
    weight_kg: weight,
    payment_amount: pay,
    pickup_location: { name: a.name, lat: a.lat, lng: a.lng },
    dropoff_location: drop,
    instructions: 'Handle with care. Call before arrival.',
    status: 'available',
  };
}

async function promptYesNo(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise(res => rl.question(q, res));
  rl.close();
  return ans.trim().toLowerCase().startsWith('y');
}

async function run() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/phone_verification';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected');

    const count = await DriverJob.countDocuments();
    if (count > 0) {
      console.log(`⚠️  Found ${count} existing driver jobs.`);
      const ok = await promptYesNo('Delete and reseed? (yes/no): ');
      if (!ok) {
        console.log('❌ Seeder cancelled.');
        process.exit(0);
      }
      await DriverJob.deleteMany({});
      console.log('🗑️  Existing jobs deleted.');
    }

    const N = Number(process.argv[2]) || 10;
    const docs = Array.from({ length: N }, (_, i) => makeJob(i));
    const created = await DriverJob.insertMany(docs);
    console.log(`🎉 Seeded ${created.length} driver jobs.`);

    // quick verify: count by status
    const byStatus = await DriverJob.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    console.log('🔎 By status:', byStatus);

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  }
}

if (require.main === module) {
  console.log('🚀 Starting Driver Job Seeder…');
  run();
}

module.exports = { run };
