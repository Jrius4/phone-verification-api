const twilio = require('twilio');
const axios = require('axios');

class SmsService {
  constructor() {
    this.client = null;
    this.init();
  }

  init() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  normalizeUgandanNumber(raw) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    // Local format → replace leading 0 with 256
    digits = "256" + digits.slice(1);
  }
  return digits;
}


  async sendEgoSms(phoneNumber, message) {
  try {
   let phoneNo = this.normalizeUgandanNumber(phoneNumber);
    const response = await axios.post(process.env.EGO_SMS_URL ||'http://sandbox.egosms.co/api/v1/json/', {
      "method": "SendSms",
      "userdata": {
        "username": process.env.EGO_SMS_USERNAME,
        "password": process.env.EGO_SMS_PASSWORD
      },
      "msgdata": [
        {
          "number": phoneNo,
          "message": message,
          "senderid": process.env.EGO_SMS_SENDER_ID || "TXTLCL",
          "priority": "0"
        }
      ]
    });

    console.log(response.data);
    return { ...response.data, success: true };
  } catch (e) {
    console.error('Ego SMS sending error:', e);
    return {
      success: false,
      error: e.message
    };
  }
}


  async sendSMS(phoneNumber, message) {
  try {
    if (!this.client) {
      return this.sendOtpMock(phoneNumber, message);
    }

    // Check if number is verified (for trial accounts)
    if (process.env.TWILIO_ACCOUNT_SID.includes('AC') &&
      process.env.TWILIO_ACCOUNT_SID.endsWith('trial')) {
      console.log('Trial account detected - using mock SMS');
      return this.sendOtpMock(phoneNumber, message);
    }

    const result = await this.client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    return {
      success: true,
      messageId: result.sid
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

  async sendOtpMock(phoneNumber, message) {
  console.log(`Mock SMS to ${phoneNumber}: ${message}`);
  return {
    success: true,
    message: 'Mock SMS sent successfully'
  };
}
}

module.exports = new SmsService();