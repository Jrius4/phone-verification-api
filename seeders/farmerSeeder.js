require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');


// Adjust the path if your models live elsewhere
const Farmer = require(path.join('..', 'models', 'Farmer'));


function parseArgs() {
    const args = Object.fromEntries(
        process.argv.slice(2).map((a) => {
            const [k, v] = a.split('=');
            return [k.replace(/^--/, ''), v === undefined ? true : v];
        })
    );
    return {
        count: Math.max(1, parseInt(args.count || args.n || '10', 10)),
        force: Boolean(args.force || args.f),
        emailDomain: args.domain || 'fty.com',
    };
}


const firstNames = ['Grace', 'Peter', 'Amina', 'John', 'Mary', 'Joseph', 'Anita', 'Paul', 'Ruth', 'Brian'];
const lastNames = ['Kato', 'Namakula', 'Okello', 'Ssebagala', 'Mukasa', 'Achan', 'Ouma', 'Kabugo', 'Nabirye', 'Lumu'];


function sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


function buildFarmer(i, domain) {
    const firstName = sample(firstNames);
    const lastName = sample(lastNames);
    const email = `farmer${String(i).padStart(3, '0')}@${domain}`;
    return {
        email,
        password: 'farmer123', // hashed by pre-save hook
        firstName,
        lastName,
        isActive: true,
        lastLogin: null,
    };
}


async function run() {
    const { count, force, emailDomain } = parseArgs();
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/phone_verification';
    console.log('Connecting to MongoDB:', uri);
    await mongoose.connect(uri);


    if (force) {
        console.log('Force enabled → removing existing farmers…');
        await Farmer.deleteMany({});
    }


    const created = [];
    for (let i = 1; i <= count; i++) {
        const doc = new Farmer(buildFarmer(i, emailDomain));
        try {
            await doc.save(); // triggers pre-save hashing
            created.push(doc.email);
            process.stdout.write(`✔︎ ${doc.email}\n`);
        } catch (e) {
            process.stdout.write(`✖ ${doc.email} — ${e.code === 11000 ? 'duplicate email' : e.message}\n`);
        }
    }


    console.log(`\nDone. Created ${created.length}/${count} farmers.`);
    await mongoose.connection.close();
}


if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });