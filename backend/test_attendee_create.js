const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Attendee = require('./src/models/Attendee');

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  try {
    const attendee = await Attendee.create({
      event: new mongoose.Types.ObjectId(), // dummy
      order: new mongoose.Types.ObjectId(), // dummy
      categoryId: 'vvip',
      categoryName: 'VVIP',
      addedVia: 'self_purchase',
      confirmationStatus: 'pending',
    });
    console.log('Attendee Created Success:', attendee._id, 'Token:', attendee.confirmationToken);
  } catch (err) {
    console.error('Attendee Created Failed:', err.message);
    if (err.errors) console.error('Errors:', Object.keys(err.errors));
  }
  await mongoose.disconnect();
}

test();
