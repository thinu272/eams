const axios = require('axios');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

async function test() {
  const SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_make_it_long_and_secure';
  // Create a token for a 'buyer'
  const token = jwt.sign({ id: '69ca04dafe69e477802758ca' }, SECRET); // Using an existing user ID from previous diagnostics
  
  try {
    const res = await axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('STATUS:', res.status);
    console.log('DATA:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('ERROR_STATUS:', err.response?.status);
    console.log('ERROR_DATA:', JSON.stringify(err.response?.data, null, 2));
  }
}

test();
