require('dotenv').config();
const mongoose = require('mongoose');
const Attendee = require('./src/models/Attendee');
const EntryLog = require('./src/models/EntryLog');
const ZoneLog = require('./src/models/ZoneLog');
const Event = require('./src/models/Event');

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eams');
  // Just find an event ID
  const event = await Event.findOne();
  if(!event) return console.log('no event');
  const eventId = event._id.toString();

  try {
    const [attendeeStats, entryStats, byZone, deniedCount] = await Promise.all([
      Attendee.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId) } },
        { $group: { _id: '$confirmationStatus', count: { $sum: 1 } } }
      ]),
      EntryLog.countDocuments({ event: eventId, action: 'check_in', accessGranted: true }),
      EntryLog.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId), action: 'zone_entry', accessGranted: true } },
        { $group: { _id: '$zoneId', zoneName: { $first: '$zoneName' }, count: { $sum: 1 } } }
      ]),
      EntryLog.countDocuments({ event: eventId, action: 'denied' })
    ]);
    console.log('STATS SUCCESS');
  } catch(e) { console.error('STATS ERROR:', e); }

  try {
     const eventIdObj = new mongoose.Types.ObjectId(eventId);
     const [zoneEntries, zoneExits] = await Promise.all([
      ZoneLog.aggregate([
        { $match: { eventId: eventIdObj, accessGranted: true, action: 'ENTRY' } },
        { $group: { _id: '$zoneName', entries: { $sum: 1 } } }
      ]),
      ZoneLog.aggregate([
        { $match: { eventId: eventIdObj, accessGranted: true, action: 'EXIT' } },
        { $group: { _id: '$zoneName', exits: { $sum: 1 } } }
      ])
    ]);
    console.log('ZONES SUCCESS');
  } catch(e) { console.error('ZONES ERROR:', e); }

  process.exit(0);
}
test();
