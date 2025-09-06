const twilio = require('twilio');


function smsClient() {
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}


async function sendOtpSms({ to, body }) {
const client = smsClient();
const from = process.env.TWILIO_FROM;
if (!client || !from) {
console.log(`📤 [SMS FAKE] → ${to}\n${body}`);
return { sid: 'FAKE' };
}
return client.messages.create({ to, from, body });
}


module.exports = { sendOtpSms };