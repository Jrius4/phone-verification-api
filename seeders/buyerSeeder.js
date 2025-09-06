require('dotenv').config();
const mongoose2 = require('mongoose');
const path2 = require('path');
const Buyer = require(path2.join('..', 'models', 'Buyer'));


function parseArgs2() {
    const args = Object.fromEntries(
        process.argv.slice(2).map((a) => {
            const [k, v] = a.split('=');
            return [k.replace(/^--/, ''), v === undefined ? true : v];
        })
    );
    return {
        count: Math.max(1, parseInt(args.count || args.n || '10', 10)),
        force: Boolean(args.force || args.f),
        emailDomain: args.domain || 'buyers.fty.com',
    };
}


const firstNamesB = ['Agnes', 'Daniel', 'Stella', 'Ivan', 'Deborah', 'Noah', 'Claire', 'Samuel', 'Joan', 'Nicholas'];
const lastNamesB = ['Kawesa', 'Mutebi', 'Nansubuga', 'Kaggwa', 'Nassaka', 'Okoth', 'Kizito', 'Baluku', 'Tumuheirwe', 'Ntege'];


function sample2(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


function buildBuyer(i, domain) {
    const firstName = sample2(firstNamesB);
    const lastName = sample2(lastNamesB);
    const email = `buyer${String(i).padStart(3, '0')}@${domain}`;
    return {
        email,
        password: 'buyer123', // hashed by pre-save hook
        firstName,
        lastName,
        isActive: true,
        lastLogin: null,
    };
}


async function run2() {
    const { count, force, emailDomain } = parseArgs2();
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/phone_verification';
    console.log('Connecting to MongoDB:', uri);
    await mongoose2.connect(uri);


    if (force) {
        console.log('Force enabled → removing existing buyers…');
        await Buyer.deleteMany({});
    }


    const created = [];
    for (let i = 1; i <= count; i++) {
        const doc = new Buyer(buildBuyer(i, emailDomain));
        try {
            await doc.save();
            created.push(doc.email);
            process.stdout.write(`✔︎ ${doc.email}\n`);
        } catch (e) {
            process.stdout.write(`✖ ${doc.email} — ${e.code === 11000 ? 'duplicate email' : e.message}\n`);
        }
    }


    console.log(`\nDone. Created ${created.length}/${count} buyers.`);
    await mongoose2.connection.close();
}


if (require.main === module) run2().catch((e) => { console.error(e); process.exit(1); });