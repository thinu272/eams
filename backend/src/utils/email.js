const nodemailer = require('nodemailer');

const createTransporter = () => {
  const isDev = !process.env.SMTP_HOST || process.env.NODE_ENV === 'development' || !process.env.SMTP_USER?.includes('@');
  if (isDev) {
    console.log('EMAIL: Using Development Transporter (Console Log only)');
    return {
      sendMail: (opts) => {
        console.log('[EMAIL - dev mode, not sent]');
        console.log('To:', opts.to);
        console.log('Subject:', opts.subject);
        return Promise.resolve({ messageId: 'dev-' + Date.now() });
      },
    };
  }
  console.log('EMAIL: Using SMTP Transporter:', process.env.SMTP_HOST);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
};

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #1A56A0; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .body { padding: 32px; }
    .footer { background: #f0f0f0; padding: 16px 32px; font-size: 12px; color: #888; }
    .btn { display: inline-block; background: #1A56A0; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 16px 0; }
    .info-row { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; }
    .info-label { font-weight: bold; width: 160px; color: #555; }
    .badge { display: inline-block; background: #E8F0FA; color: #1A56A0; padding: 4px 12px; border-radius: 12px; font-size: 13px; margin: 2px; }
    .qr-section { text-align: center; padding: 24px; background: #f9f9f9; border-radius: 8px; margin: 16px 0; }
    .alert { background: #E8F5E9; border-left: 4px solid #2E7D32; padding: 12px 16px; border-radius: 4px; margin: 16px 0; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Event Access Management System</h1>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    This is an automated email. Do not reply to this message.<br>
    &copy; ${new Date().getFullYear()} EAMS — Event Access Management System
  </div>
</div>
</body>
</html>`;

const sendOrderConfirmation = async (order, event) => {
  const transporter = createTransporter();
  const confirmUrl = `${process.env.FRONTEND_URL}/confirm/${order.confirmationLink}`;
  const html = baseTemplate(`
    <h2>Order Confirmed!</h2>
    <div class="alert">Your order has been received. Please complete the ticket confirmation below.</div>
    <p>Dear <strong>${order.buyerName}</strong>,</p>
    <p>Thank you for your purchase for <strong>${event.name}</strong>.</p>
    <div class="info-row"><span class="info-label">Order Number</span><span>${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span>${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span>${event.venue?.name}, ${event.venue?.city}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span>${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
    <div class="info-row"><span class="info-label">Tickets</span><span>${order.items.map(i => `${i.quantity}x ${i.categoryName}`).join(', ')}</span></div>
    <div class="info-row"><span class="info-label">Total Amount</span><span>${order.currency} ${order.totalAmount.toLocaleString()}</span></div>
    <br>
    <p>Click the button below to confirm the identity for each ticket:</p>
    <a class="btn" href="${confirmUrl}">Confirm Tickets</a>
    <p style="font-size:13px;color:#888;">This link expires in 72 hours. Each ticket holder must confirm their identity before the event.</p>
  `);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eams.com',
    to: order.buyerEmail,
    subject: `Order Confirmed — ${event.name} (${order.orderNumber})`,
    html,
  });
};

const sendAttendeeInvite = async (attendee, event) => {
  const transporter = createTransporter();
  const confirmUrl = `${process.env.FRONTEND_URL}/invite/${attendee.confirmationToken}`;
  const html = baseTemplate(`
    <h2>You've Been Invited!</h2>
    <p>You have been invited to attend <strong>${event.name}</strong>.</p>
    <p>Please confirm your identity by clicking the button below:</p>
    <div class="info-row"><span class="info-label">Event</span><span>${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span>${event.venue?.name}, ${event.venue?.city}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span>${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
    <br>
    <a class="btn" href="${confirmUrl}">Confirm My Identity</a>
    <p style="font-size:13px;color:#888;">You will need to provide your full name, ID details, and a photo for verification.</p>
  `);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eams.com',
    to: attendee.email,
    subject: `You're Invited — ${event.name}`,
    html,
  });
};

const sendFinalConfirmation = async (attendee, event) => {
  const transporter = createTransporter();
  const zonesHtml = (attendee.allowedZones || []).map(z => `<span class="badge">${z}</span>`).join('');
  const html = baseTemplate(`
    <h2>Ticket Confirmed!</h2>
    <div class="alert">Your attendance is confirmed. Please bring this email (or your QR code) to the event.</div>
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>Your ticket for <strong>${event.name}</strong> has been fully confirmed.</p>
    <div class="info-row"><span class="info-label">Event</span><span>${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span>${event.venue?.name}, ${event.venue?.city}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span>${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
    <div class="info-row"><span class="info-label">Ticket Category</span><span>${attendee.categoryName}</span></div>
    <div class="info-row"><span class="info-label">Zone Access</span><span>${zonesHtml || 'General'}</span></div>
    <div class="info-row"><span class="info-label">Ticket Number</span><span>${attendee.qrToken}</span></div>
    ${attendee.qrCode ? `
    <div class="qr-section">
      <p style="font-weight:bold;margin-bottom:12px;">Your Entry QR Code</p>
      <img src="${attendee.qrCode}" alt="QR Code" style="width:200px;height:200px;">
      <p style="font-size:12px;color:#888;margin-top:8px;">Present this QR code at the entrance gate</p>
    </div>` : ''}
    <p style="font-size:13px;color:#555;">A wristband with RFID will be issued to you at the main gate after verification. Keep your QR code accessible on entry.</p>
  `);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eams.com',
    to: attendee.email,
    subject: `Confirmed — Your ticket for ${event.name}`,
    html,
  });
};

const sendPhotoRejection = async (attendee, event, reason, resubmitLink) => {
  const transporter = createTransporter();
  const html = baseTemplate(`
    <h2>Photo Verification Failed ❌</h2>
    <div class="alert" style="background:#FFEBEE;border-left-color:#D32F2F;">Your photo was rejected and needs to be resubmitted.</div>
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>Your photo for <strong>${event.name}</strong> was not accepted for verification.</p>
    <div class="info-row"><span class="info-label">Reason</span><span>${reason}</span></div>
    <p>Please re-upload a clear photo that meets the following requirements:</p>
    <ul>
      <li>Clear face visible</li>
      <li>Good lighting</li>
      <li>No blur or distortion</li>
      <li>Recent photo</li>
    </ul>
    <a href="${resubmitLink}" class="btn">Resubmit Photo</a>
    <p style="font-size:13px;color:#555;">If you have any questions, please contact the event organiser.</p>
  `);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eams.com',
    to: attendee.email,
    subject: `Photo Rejected — Resubmit for ${event.name}`,
    html,
  });
};

module.exports = { sendOrderConfirmation, sendAttendeeInvite, sendFinalConfirmation, sendPhotoRejection };
