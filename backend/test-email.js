require('dotenv').config();
const mongoose = require('mongoose');
const { sendVerificationEmail } = require('./src/utils/email');

const testEmail = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const user = {
      name: 'Thinu Upadya',
      email: 'upadyathinu@gmail.com',
    };

    console.log('Sending FULL HTML test email to: upadyathinu@gmail.com');
    await sendVerificationEmail(user, 'http://localhost:3000/verify/test');
    console.log('Test email task completed successfully');
    
    process.exit(0);
  } catch (err) {
    console.error('TEST SCRIPT ERROR:', err);
    if (err.response && err.response.body) {
      console.error('ERROR BODY:', JSON.stringify(err.response.body, null, 2));
    }
    process.exit(1);
  }
};

testEmail();
