const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Event = require('./src/models/Event');

dotenv.config();

async function findEvent() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  const event = await Event.findOne({ status: 'published' });
  if (event) {
    console.log('EVENT_ID=' + event._id);
    console.log('CATEGORY_ID=' + event.categories[0].id);
  } else {
    console.log('No published events found');
  }
  await mongoose.disconnect();
}

findEvent();
