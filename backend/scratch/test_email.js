require('dotenv').config({ path: '../backend/.env' });
const nodemailer = require('nodemailer');

const testEmail = async () => {
  console.log('Testing Email Configuration...');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@entrynex.com',
      to: process.env.EMAIL_FROM, // Send to self
      subject: 'ENTRYNEX - Email Test',
      text: 'If you receive this, the email configuration is correct.',
      html: '<b>If you receive this, the email configuration is correct.</b>'
    });
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('Email failed to send:');
    console.error(error);
  }
};

testEmail();
