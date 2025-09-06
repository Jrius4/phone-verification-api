require('dotenv').config();
const mongoose3 = require('mongoose');
const path3 = require('path');
const Farmer3 = require(path3.join('..', 'models', 'Farmer'));
const Buyer3 = require(path3.join('..', 'models', 'Buyer'));


function parseArgs3() {
const map = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.split('='); return [k.replace(/^--/, ''), v === undefined ? true : v]; }));
return {
farmers: Math.max(0, parseInt(map.farmers || '10', 10)),
buyers: Math.max(0, parseInt(map.buyers || '10', 10)),
force: Boolean(map.force || map.f),
domainFarmers: map.fdomain || 'fty.com',
domainBuyers: map.bdomain || 'buyers.fty.com',
};
}


const FN = ['Grace','Peter','Amina','John','Mary','Joseph','Anita','Paul','Ruth','Brian'];
const LN = ['Kato','Namakula','Okello','Ssebagala','Mukasa','Achan','Ouma','Kabugo','Nabirye','Lumu'];
const FN2 = ['Agnes','Daniel','Stella','Ivan','Deborah','Noah','Claire','Samuel','Joan','Nicholas'];
const LN2 = ['Kawesa','Mutebi','Nansubuga','Kaggwa','Nassaka','Okoth','Kizito','Baluku','Tumuheirwe','Ntege'];
const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];


function makeFarmer(i, domain) { return { email: `farmer${String(i).padStart(3,'0')}@${domain}`, password: 'farmer123', firstName: pick(FN), lastName: pick(LN), isActive: true }; }
function makeBuyer(i, domain) { return { email: `buyer${String(i).padStart(3,'0')}@${domain}`, password: 'buyer123', firstName: pick(FN2), lastName: pick(LN2), isActive: true }; }


async function seedModel(Model, items, label) {
const created = [];
for (const item of items) {
try {
const doc = new Model(item);
await doc.save();
created.push(doc.email);
process.stdout.write(`✔︎ ${label}: ${doc.email}\n`);
} catch (e) {
process.stdout.write(`✖ ${label}: ${item.email} — ${e.code === 11000 ? 'duplicate email' : e.message}\n`);
}
}
return created.length;
}


async function run3() {
const { farmers, buyers, force, domainFarmers, domainBuyers } = parseArgs3();
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/phone_verification';
console.log('Connecting to MongoDB:', uri);
await mongoose3.connect(uri);


if (force) {
console.log('Force enabled → clearing collections…');
await Promise.all([Farmer3.deleteMany({}), Buyer3.deleteMany({})]);
}


const farmerItems = Array.from({ length: farmers }, (_, i) => makeFarmer(i + 1, domainFarmers));
const buyerItems = Array.from({ length: buyers }, (_, i) => makeBuyer(i + 1, domainBuyers));


const f = await seedModel(Farmer3, farmerItems, 'Farmer');
const b = await seedModel(Buyer3, buyerItems, 'Buyer');


console.log(`\n✅ Seeding complete. Farmers: ${f}/${farmers}, Buyers: ${b}/${buyers}`);
await mongoose3.connection.close();
}


if (require.main === module) run3().catch((e) => { console.error(e); process.exit(1); });