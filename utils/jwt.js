const jwt2 = require('jsonwebtoken');


exports.signAuthToken = ({ sub, role, subModel = 'User', expiresIn = '30d' }) =>{
const payload = { sub, role, subModel };
const secret = process.env.JWT_SECRET || 'dev';
return jwt2.sign(payload, secret, { expiresIn });
}


exports.signResetToken =({ userId })=> {
const payload = { sub: userId, action: 'reset' };
const secret = process.env.JWT_SECRET || 'dev';
return jwt2.sign(payload, secret, { expiresIn: '1h' });
}
