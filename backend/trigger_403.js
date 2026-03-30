const axios = require('axios');

async function test() {
  try {
    // Try to access a restricted route without token (should be 401)
    const res1 = await axios.get('http://localhost:5000/api/users');
    console.log('RES1_STATUS:', res1.status);
  } catch (err) {
    console.log('RES1_ERROR:', err.response?.status);
  }

  try {
    // Try to access a restricted route with a VALID token but WRONG role (should be 403)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: '69ca04dafe69e477802758ca' }, 'your_jwt_secret_key_here_make_it_long_and_secure');
    const res2 = await axios.get('http://localhost:5000/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('RES2_STATUS:', res2.status);
  } catch (err) {
    console.log('RES2_ERROR:', err.response?.status);
  }
}

test();
