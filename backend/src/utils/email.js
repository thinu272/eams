const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

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

const getSendGridClient = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return null;
  sgMail.setApiKey(apiKey);
  return sgMail;
};

const sendWithProvider = async ({ to, subject, html, templateId, dynamicTemplateData, attachments = [] }) => {
  const from = process.env.EMAIL_FROM || 'noreply@eams.com';
  const sendGrid = getSendGridClient();

  if (sendGrid) {
    const msg = {
      to,
      from,
      subject,
      html,
      attachments,
    };

    if (templateId) {
      msg.templateId = templateId;
      msg.dynamicTemplateData = dynamicTemplateData;
      delete msg.subject;
      delete msg.html;
    }

    await sendGrid.send(msg);
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    attachments,
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
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/order/${order.confirmationToken}/confirm`;
  const ticketSummary = (order.tickets || [])
    .map((item) => `${item.quantity}x ${item.categoryName}`)
    .join(', ');
  const html = baseTemplate(`
    <h2>Order Confirmed!</h2>
    <div class="alert">Your order has been received. Please complete the ticket confirmation below.</div>
    <p>Dear <strong>${order.buyerName}</strong>,</p>
    <p>Thank you for your purchase for <strong>${event.name}</strong>.</p>
    <div class="info-row"><span class="info-label">Order Number</span><span>${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span>${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span>${event.venue?.name}, ${event.venue?.city}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span>${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
    <div class="info-row"><span class="info-label">Tickets</span><span>${ticketSummary || 'N/A'}</span></div>
    <div class="info-row"><span class="info-label">Total Amount</span><span>LKR ${order.totalAmount.toLocaleString()}</span></div>
    <br>
    <p>Click the button below to confirm the identity for each ticket:</p>
    <a class="btn" href="${confirmUrl}">Confirm Tickets</a>
    <p style="font-size:13px;color:#888;">This link expires in 72 hours. Each ticket holder must confirm their identity before the event.</p>
  `);
  await sendWithProvider({
    to: order.buyerEmail,
    subject: `Order Confirmed — ${event.name} (${order.orderNumber})`,
    html,
  });
};

const sendAttendeeInvite = async (attendee, event) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/invite/${attendee.confirmationToken}`;
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
  await sendWithProvider({
    to: attendee.email,
    subject: `You're Invited — ${event.name}`,
    html,
  });
};

const sendFinalConfirmation = async (payloadOrAttendee, maybeEvent) => {
  const isLegacyCall = payloadOrAttendee && !payloadOrAttendee.attendee && !!maybeEvent;
  const normalized = isLegacyCall
    ? {
        attendee: payloadOrAttendee,
        event: maybeEvent,
        ticketCategory: payloadOrAttendee?.categoryName,
        packageDescription: 'Standard access package',
        zoneAccessList: payloadOrAttendee?.allowedZones || [],
        qrPayloadString: payloadOrAttendee?.qrToken || '',
        qrImageBuffer: null,
        supportEmail: process.env.EVENT_SUPPORT_EMAIL || 'support@eams.com',
        supportPhone: process.env.EVENT_SUPPORT_PHONE || '+94 11 234 5678',
      }
    : payloadOrAttendee;

  const {
    attendee,
    event,
    ticketCategory,
    packageDescription,
    zoneAccessList,
    qrPayloadString,
    qrImageBuffer,
    supportEmail,
    supportPhone,
  } = normalized;

  const zonesHtml = (zoneAccessList || []).map((z) => `<span class="badge">${z}</span>`).join('');
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const html = baseTemplate(`
    <h2>Ticket Confirmed!</h2>
    <div class="alert">Your profile is verified and your final event QR is ready.</div>
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>Your ticket for <strong>${event.name}</strong> is fully confirmed.</p>
    <div class="info-row"><span class="info-label">Event</span><span>${event.name}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span>${eventDate}</span></div>
    <div class="info-row"><span class="info-label">Time</span><span>${eventTime}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span>${event.venue?.name}, ${event.venue?.city}</span></div>
    <div class="info-row"><span class="info-label">Ticket Category</span><span>${ticketCategory || attendee.categoryName}</span></div>
    <div class="info-row"><span class="info-label">Package</span><span>${packageDescription || 'Standard access package'}</span></div>
    <div class="info-row"><span class="info-label">Zone Access</span><span>${zonesHtml || 'General'}</span></div>
    ${qrPayloadString ? `<div class="info-row"><span class="info-label">QR Payload</span><span style="word-break:break-all">${qrPayloadString}</span></div>` : ''}
    ${qrImageBuffer ? `
    <div class="qr-section">
      <p style="font-weight:bold;margin-bottom:12px;">Your Entry QR Code</p>
      <img src="cid:attendee-qr" alt="QR Code" style="width:200px;height:200px;">
      <p style="font-size:12px;color:#888;margin-top:8px;">Present this QR code at the entrance gate</p>
    </div>` : ''}
    <p style="font-size:13px;color:#555;">Support: ${supportEmail || 'support@eams.com'} | ${supportPhone || 'N/A'}</p>
  `);

  const dynamicTemplateData = {
    attendeeName: attendee.fullName,
    eventName: event.name,
    eventDate,
    eventTime,
    venue: `${event.venue?.name || ''}, ${event.venue?.city || ''}`.trim(),
    ticketCategory: ticketCategory || attendee.categoryName,
    packageDescription: packageDescription || 'Standard access package',
    zoneAccessList: (zoneAccessList || []).join(', '),
    supportEmail: supportEmail || 'support@eams.com',
    supportPhone: supportPhone || 'N/A',
  };

  await sendWithProvider({
    to: attendee.email,
    subject: `Confirmed — Your ticket for ${event.name}`,
    html,
    templateId: process.env.SENDGRID_FINAL_CONFIRMATION_TEMPLATE_ID,
    dynamicTemplateData,
    attachments: qrImageBuffer
      ? [{
          content: qrImageBuffer.toString('base64'),
          filename: 'ticket-qr.png',
          type: 'image/png',
          disposition: 'inline',
          content_id: 'attendee-qr',
        }]
      : [],
  });
};

const sendBuyerFinalSummary = async ({
  buyerName,
  buyerEmail,
  orderNumber,
  event,
  attendees,
  supportEmail,
  supportPhone,
}) => {
  const rows = (attendees || [])
    .map((a) => `<li>${a.fullName} — ${a.categoryName} (${a.email})</li>`)
    .join('');

  const html = baseTemplate(`
    <h2>All Attendees Verified</h2>
    <p>Dear <strong>${buyerName || 'Buyer'}</strong>,</p>
    <p>All ticket slots in your order are now verified for <strong>${event.name}</strong>.</p>
    <div class="info-row"><span class="info-label">Order Number</span><span>${orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span>${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span>${event.venue?.name}, ${event.venue?.city}</span></div>
    <p style="margin-top:16px;font-weight:bold">Confirmed Attendees</p>
    <ul>${rows || '<li>No attendees found.</li>'}</ul>
    <p style="font-size:13px;color:#555;">Support: ${supportEmail || 'support@eams.com'} | ${supportPhone || 'N/A'}</p>
  `);

  await sendWithProvider({
    to: buyerEmail,
    subject: `Attendee Verification Complete — ${event.name}`,
    html,
    templateId: process.env.SENDGRID_BUYER_SUMMARY_TEMPLATE_ID,
    dynamicTemplateData: {
      buyerName: buyerName || 'Buyer',
      orderNumber,
      eventName: event.name,
      attendeeCount: (attendees || []).length,
      attendees: attendees || [],
      supportEmail: supportEmail || 'support@eams.com',
      supportPhone: supportPhone || 'N/A',
    },
  });
};

const sendPhotoRejection = async (attendee, event, reason, resubmitLink) => {
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
  await sendWithProvider({
    to: attendee.email,
    subject: `Photo Rejected — Resubmit for ${event.name}`,
    html,
  });
};

const sendConfirmationReminder = async (attendee, event) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/invite/${attendee.confirmationToken}`;
  const html = baseTemplate(`
    <h2>Action Required: Confirm Your Identity</h2>
    <p>Dear <strong>${attendee.fullName || 'Attendee'}</strong>,</p>
    <p>This is a reminder to complete your identity confirmation for <strong>${event.name}</strong>.</p>
    <a class="btn" href="${confirmUrl}">Confirm My Identity</a>
    <p style="font-size:13px;color:#888;">Please complete before the deadline to avoid ticket cancellation.</p>
  `);
  await sendWithProvider({
    to: attendee.email,
    subject: `Reminder - Confirm your ticket for ${event.name}`,
    html,
  });
};

const sendSubOrganiserInvite = async (user, event) => {
  const html = baseTemplate(`
    <h2>You have been invited as a Sub-Organiser</h2>
    <p>Dear <strong>${user.name || 'Organizer'}</strong>,</p>
    <p>You have been invited to manage operations${event?.name ? ` for <strong>${event.name}</strong>` : ''}.</p>
    <p>Please log in to your EAMS account to view your assignments.</p>
  `);
  await sendWithProvider({
    to: user.email,
    subject: `Sub-Organiser Invite ${event?.name ? `- ${event.name}` : ''}`,
    html,
  });
};

const sendStatusChange = async (attendee, event, status, message) => {
  const html = baseTemplate(`
    <h2>Status Update</h2>
    <p>Dear <strong>${attendee.fullName || 'Attendee'}</strong>,</p>
    <p>Your ticket for <strong>${event?.name || 'the event'}</strong> has been updated.</p>
    <div class="info-row"><span class="info-label">Status</span><span>${status}</span></div>
    ${message ? `<p>${message}</p>` : ''}
  `);
  await sendWithProvider({
    to: attendee.email,
    subject: `Status Update - ${event?.name || 'Event'}`,
    html,
  });
};

const sendBuyerPhotoRejection = async (buyer, event, attendee, reason, resubmitLink) => {
  const html = baseTemplate(`
    <h2>Attendee Photo Rejected</h2>
    <p>Dear <strong>${buyer.name || 'Buyer'}</strong>,</p>
    <p>The attendee photo for <strong>${event?.name || 'your event'}</strong> was rejected.</p>
    <div class="info-row"><span class="info-label">Attendee</span><span>${attendee.fullName || attendee.email}</span></div>
    <div class="info-row"><span class="info-label">Reason</span><span>${reason}</span></div>
    <p>Please ask the attendee to resubmit: <a href="${resubmitLink}">Resubmit Photo</a></p>
  `);
  await sendWithProvider({
    to: buyer.email,
    subject: `Photo Rejected - ${event?.name || 'Event'}`,
    html,
  });
};

module.exports = {
  sendOrderConfirmation,
  sendAttendeeInvite,
  sendFinalConfirmation,
  sendBuyerFinalSummary,
  sendPhotoRejection,
  sendConfirmationReminder,
  sendSubOrganiserInvite,
  sendStatusChange,
  sendBuyerPhotoRejection,
};
