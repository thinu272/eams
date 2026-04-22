const https = require('http');
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Event = require('./src/models/Event');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eams');
  const user = await User.findOne({ role: 'main_organiser' });
  if (!user) return console.log('no user');
  
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'fallback', { expiresIn: '1d' });
  const event = await Event.findOne();
  if(!event) return console.log('no event');
  const eventId = event._id.toString();

  const paths = [
    `/api/organiser/event/${eventId}/stats`,
    `/api/organiser/event/${eventId}/entry-logs`,
    `/api/organiser/event/${eventId}/zones/report`
  ];

  for (let path of paths) {
    console.log('Testing', path);
    await new Promise(resolve => {
      const req = https.get({
        hostname: '127.0.0.1',
        port: 5000,
        path: path,
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Status: ${res.statusCode} `);
          if(res.statusCode !== 200) console.log(data);
          resolve();
        });
      });
      req.on('error', e => { console.error(e); resolve();});
      req.end();
    });
  }
  process.exit(0);
}
run();
