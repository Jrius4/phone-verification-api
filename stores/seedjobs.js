// seed.js
const store = require('./src/store');

// wipe
store.jobs.length = 0;

// helpers
const rnd = (min, max) => +(Math.random() * (max - min) + min).toFixed(5);

// Kampala-ish coords to vary pickup/drop
const KLA = { lat: 0.3476, lng: 32.5825 };
const areas = [
  { name: 'Nakasero Market', lat: 0.3225, lng: 32.5760 },
  { name: 'Nakawa Market', lat: 0.3321, lng: 32.6140 },
  { name: 'Wandegeya',     lat: 0.3392, lng: 32.5685 },
  { name: 'Kalerwe',       lat: 0.3749, lng: 32.5718 },
  { name: 'Kireka',        lat: 0.3486, lng: 32.6637 },
];

const commodities = ['Maize', 'Beans', 'Matooke', 'Coffee', 'Groundnuts'];

for (let i = 0; i < 10; i++) {
  const pick = areas[Math.floor(Math.random() * areas.length)];
  const drop = { name: 'Buyer Warehouse', lat: KLA.lat + rnd(-0.02, 0.02), lng: KLA.lng + rnd(-0.02, 0.02) };
  const commodity = commodities[Math.floor(Math.random() * commodities.length)];
  const weight = [50, 80, 100, 150, 200][Math.floor(Math.random() * 5)];
  const pay = [25000, 30000, 35000, 40000, 50000][Math.floor(Math.random() * 5)];

  store.createJob({
    buyer_name: `Buyer ${i+1}`,
    buyer_phone: `+25670${Math.floor(1000000 + Math.random()*8999999)}`,
    farmer_name: `Farmer ${i+1}`,
    commodity,
    weight_kg: weight,
    payment_amount: pay,
    pickup_location: { name: pick.name, lat: pick.lat, lng: pick.lng },
    dropoff_location: drop,
    instructions: 'Handle with care. Call before arrival.',
    status: 'available',
  });
}

console.log(`Seeded ${store.jobs.length} jobs`);
