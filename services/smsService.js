const twilio = require('twilio');

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

  async sendSMS(phoneNumber, message) {
    try {
      if (!this.client) {
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