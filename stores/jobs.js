// src/store.js
const { v4: uuid } = require('uuid');

const jobs = []; // each job: {id, buyer_name, buyer_phone, farmer_name, commodity, weight_kg, payment_amount, pickup_location:{lat,lng,name}, dropoff_location:{lat,lng,name}, instructions, status, driverId}

function createJob(partial) {
  const job = {
    id: uuid(),
    buyer_name: 'Buyer',
    buyer_phone: '+256700000000',
    farmer_name: 'Farmer',
    commodity: 'Maize',
    weight_kg: 100,
    payment_amount: 35000,
    pickup_location: { lat: 0.3476, lng: 32.5825, name: 'Kampala Market' },
    dropoff_location: { lat: 0.3136, lng: 32.5811, name: 'Warehouse' },
    instructions: 'Call buyer on arrival.',
    status: 'available', // available | active | completed
    driverId: null,
    createdAt: Date.now(),
    ...partial,
  };
  jobs.unshift(job);
  return job;
}

function findJob(id) {
  return jobs.find(j => String(j.id) === String(id));
}

function removeJob(id) {
  const i = jobs.findIndex(j => String(j.id) === String(id));
  if (i >= 0) jobs.splice(i, 1);
  return i >= 0;
}

module.exports = { jobs, createJob, findJob, removeJob };
