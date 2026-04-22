const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const checkUsers = async () => {
    try {
        console.log('Connecting to', process.env.MONGO_URI ? 'DB...' : 'MISSING URI');
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({});
        console.log(`Found ${users.length} users.`);
        users.forEach(u => console.log(`- ${u.email} [${u.role}] [${u.status}]`));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUsers();
