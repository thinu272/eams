const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

const createTransporter = () => {
  const hasSmtpCreds = process.env.SMTP_HOST && process.env.SMTP_PASS;
  const hasSendGridKey = process.env.SENDGRID_API_KEY;
  
  // Only use dev transporter if NO real credentials are found
  const isDev = !hasSmtpCreds && !hasSendGridKey;

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
  const from = process.env.EMAIL_FROM || 'noreply@entrynex.com';
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
  const smtpAttachments = attachments.map((attachment) => ({
    ...attachment,
    encoding: attachment.content && typeof attachment.content === 'string' ? 'base64' : attachment.encoding,
  }));
  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    attachments: smtpAttachments,
  });
};

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .header { background: #0a1128; background: linear-gradient(135deg, #0a1128 0%, #2684ff 100%); color: #ffffff; padding: 40px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
    .body { padding: 40px 32px; line-height: 1.6; }
    .footer { background: #f1f5f9; padding: 24px 32px; font-size: 12px; color: #64748b; text-align: center; }
    .btn { display: inline-block; background: #2684ff; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; margin: 24px 0; box-shadow: 0 10px 15px -3px rgba(38, 132, 255, 0.3); }
    .info-row { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .info-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
    .info-value { font-size: 16px; font-weight: 600; color: #0f172a; }
    .badge { display: inline-block; background: #cce3fd; color: #0a1128; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin: 2px; }
    .qr-section { text-align: center; padding: 32px; background: #f8fafc; border-radius: 24px; border: 2px dashed #e2e8f0; margin: 24px 0; }
    .alert { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 8px; margin-bottom: 24px; color: #166534; font-weight: 500; }
    .h2 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>ENTRYNEX</h1>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    This is an automated email. Do not reply to this message.<br>
    &copy; ${new Date().getFullYear()} ENTRYNEX — Event Access Management System
  </div>
</div>
</body>
</html>`;

const sendOrderConfirmation = async (order, event, options = {}) => {
  const { pdfBuffer, stage = 'paid' } = options;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/order/${order.confirmationToken}/confirm`;
  const ticketSummary = (order.tickets || [])
    .map((item) => `${item.quantity} x ${item.categoryName}`)
    .join(', ');
    
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  const isPaid = stage === 'paid';
  const title = isPaid ? 'Order Confirmed!' : 'Order Received!';
  const alert = isPaid
    ? 'Your payment has been received. The next step is assigning attendees so each ticket can be activated.'
    : 'Your order has been created successfully. Complete payment to continue the ticket activation flow.';
  const intro = isPaid
    ? `Thank you for choosing ENTRYNEX for <strong>${event.name}</strong>. Your payment of <strong>LKR ${order.totalAmount.toLocaleString()}</strong> has been processed.`
    : `Thank you for choosing ENTRYNEX for <strong>${event.name}</strong>. Your order for <strong>LKR ${order.totalAmount.toLocaleString()}</strong> has been created and is waiting for payment confirmation.`;
  const cta = isPaid ? 'Complete Ticket Confirmation' : 'View Order Details';
  const subject = isPaid
    ? `Order Confirmed - ${event.name} (${order.orderNumber})`
    : `Order Received - ${event.name} (${order.orderNumber})`;

  const html = baseTemplate(`
    <h2 class="h2">${title}</h2>
    <div class="alert">${alert}</div>
    
    <p>Dear <strong>${order.buyerName}</strong>,</p>
    <p>${intro}</p>
    
    <div class="info-row"><span class="info-label">Order Reference</span><span class="info-value">#${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${eventDate}</span></div>
    <div class="info-row"><span class="info-label">Tickets Purchased</span><span class="info-value">${ticketSummary || 'N/A'}</span></div>
    
    <div style="text-align: center; margin-top: 32px;">
      <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">${isPaid ? 'Assign attendees to activate tickets:' : 'You can review your order here:'}</p>
      <a class="btn" href="${confirmUrl}">${cta}</a>
    </div>
    
    <p style="font-size:12px; color: #94a3b8; text-align: center; margin-top: 24px;">
      ${isPaid
        ? 'Note: Each ticket holder must provide their details and photo for verification before entry is granted.'
        : 'Note: Ticket assignment and attendee confirmation continue after payment is completed.'}
    </p>
  `);
  await sendWithProvider({
    to: order.buyerEmail,
    subject,
    html,
    attachments: pdfBuffer ? [{
      content: pdfBuffer.toString('base64'),
      filename: `purchase-summary-${order.orderNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }] : [],
  });
};

const sendAttendeeInvite = async ({ attendee, event, ticketDetails }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/invite/${attendee.confirmationToken}`;
  
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const html = baseTemplate(`
    <h2 class="h2">You've Been Invited!</h2>
    <p>Great news! You have been invited to attend <strong>${event.name}</strong>.</p>
    <div class="alert">Please confirm your identity and upload your photo to receive your entry ticket.</div>
    
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Date & Time</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    
    <div style="margin-top: 24px; padding: 20px; background: #f1f5f9; border-radius: 12px;">
      <h3 style="margin-top:0; font-size: 14px; color: #475569;">TICKET DETAILS</h3>
      <div style="font-size: 18px; font-weight: 700; color: #0a1128;">${ticketDetails.categoryName}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Assigned to: ${attendee.email}</div>
    </div>
    
    <div style="text-align: center;">
      <a class="btn" href="${confirmUrl}">Confirm My Identity</a>
    </div>
    
    <p style="font-size:13px;color:#64748b; margin-top: 24px; text-align: center;">
      You will need to provide your full name, ID details, and a clear photo for verification.
    </p>
  `);

  await sendWithProvider({
    to: attendee.email,
    subject: `Invitation: ${event.name} — Action Required`,
    html,
  });
};

const sendFinalConfirmation = async (payload) => {
  const {
    attendee,
    event,
    ticketCategory,
    packageDescription,
    zoneAccessList,
    pdfBuffer,
    supportEmail,
    supportPhone,
  } = payload;

  const zonesHtml = (zoneAccessList || []).map((z) => `<span class="badge">${z}</span>`).join('');
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const html = baseTemplate(`
    <h2 class="h2">Your Ticket is Ready!</h2>
    <div class="alert">Your ticket is confirmed. Please present the attached PDF with the embedded QR code at entry.</div>
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>Your ticket for <strong>${event.name}</strong> is now fully confirmed.</p>
    
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Date & Time</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Category</span><span class="info-value">${ticketCategory || attendee.categoryName}</span></div>
    <div class="info-row"><span class="info-label">Zones</span><span class="info-value">${zonesHtml || 'General Access'}</span></div>
    
    <div class="qr-section">
      <p style="font-weight:700; color: #0a1128; margin-bottom:16px;">ATTACHED PDF TICKET</p>
      <p style="font-size:12px; color: #64748b; margin-top:16px;">The attached PDF includes your event details and the same QR used in your attendee dashboard.</p>
    </div>
    
    <div style="margin-top: 32px; padding: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64748b; text-align: center;">
      Need help? Contact us at <br>
      <strong>${supportEmail || 'support@entrynex.com'}</strong> ${supportPhone ? `| <strong>${supportPhone}</strong>` : ''}
    </div>
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
    supportEmail: supportEmail || 'support@entrynex.com',
    supportPhone: supportPhone || 'N/A',
  };

  await sendWithProvider({
    to: attendee.email,
    subject: `Confirmed: Your entry ticket for ${event.name}`,
    html,
    templateId: process.env.SENDGRID_FINAL_CONFIRMATION_TEMPLATE_ID,
    dynamicTemplateData,
    attachments: pdfBuffer
      ? [{
          content: pdfBuffer.toString('base64'),
          filename: `ticket-${(attendee.fullName || 'attendee').replace(/\s+/g, '-').toLowerCase()}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
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
    <p style="font-size:13px;color:#555;">Support: ${supportEmail || 'support@entrynex.com'} | ${supportPhone || 'N/A'}</p>
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
      supportEmail: supportEmail || 'support@entrynex.com',
      supportPhone: supportPhone || 'N/A',
    },
  });
};

const sendPhotoRejection = async (attendee, event, reason, resubmitLink) => {
  const html = baseTemplate(`
    <h2 class="h2">Photo Verification Failed</h2>
    <div class="alert" style="background:#fef2f2; border-left-color:#ef4444; color:#991b1b;">Your photo was not accepted for verification.</div>
    
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>Unfortunately, your photo for <strong>${event?.name || 'the event'}</strong> was not accepted for the following reason:</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #fff1f2; border-radius: 12px; border: 1px solid #fecaca;">
      <span class="info-label">REASON FOR REJECTION</span>
      <div style="font-size: 16px; font-weight: 600; color: #b91c1c;">${reason}</div>
    </div>
    
    <p>To receive your entry ticket, please re-upload a clear photo that meets our requirements:</p>
    <ul style="color: #475569; font-size: 14px;">
      <li>Clear face visible with no obstruction</li>
      <li>Good lighting (no shadows or glare)</li>
      <li>Neutral background preferred</li>
      <li>Recent photo (no filters)</li>
    </ul>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${resubmitLink}" class="btn">Resubmit My Photo</a>
    </div>
    
    <p style="font-size:13px; color:#64748b; margin-top: 24px; text-align: center;">
      If you have any questions, please contact the event organiser.
    </p>
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
    <h2 class="h2">Sub-Organiser Invitation</h2>
    <div class="alert">You have been selected to help manage event operations.</div>
    
    <p>Dear <strong>${user.name || 'Organizer'}</strong>,</p>
    <p>You have been invited to manage operations${event?.name ? ` for <strong>${event.name}</strong>` : ''}.</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #f1f5f9; border-radius: 12px; border: 1px solid #e2e8f0;">
      <h3 style="margin-top:0; font-size: 14px; color: #475569;">EVENT DETAILS</h3>
      <div style="font-size: 18px; font-weight: 700; color: #0a1128;">${event?.name || 'Assigned Event'}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Role: Sub-Organiser</div>
    </div>

    <p>Please log in to your ENTRYNEX account using your registered email address to view your assignments and start managing the event.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login">Log In to Dashboard</a>
    </div>
  `);
  await sendWithProvider({
    to: user.email,
    subject: `ENTRYNEX: Sub-Organiser Invite ${event?.name ? `- ${event.name}` : ''}`,
    html,
  });
};

const sendStatusChange = async (attendee, event, status, message) => {
  const html = baseTemplate(`
    <h2 class="h2">Ticket Status Updated</h2>
    <div class="alert" style="background: #eff6ff; border-left-color: #3b82f6; color: #1e40af;">The status of your ticket for ${event?.name || 'the event'} has changed.</div>
    
    <p>Dear <strong>${attendee.fullName || 'Attendee'}</strong>,</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <span class="info-label">NEW STATUS</span>
      <div style="font-size: 18px; font-weight: 700; color: #0a1128; text-transform: uppercase;">${status}</div>
    </div>

    ${message ? `
    <div style="margin-top: 16px;">
      <h3 style="font-size: 14px; color: #475569; margin-bottom: 8px;">Message from Organiser:</h3>
      <p style="padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569;">${message}</p>
    </div>` : ''}

    <p style="margin-top: 24px;">Please visit the ENTRYNEX portal to view your updated ticket details.</p>
  `);
  await sendWithProvider({
    to: attendee.email,
    subject: `ENTRYNEX: Ticket Status Update - ${event?.name || 'Event'}`,
    html,
  });
};

const sendBuyerPhotoRejection = async (buyer, event, attendee, reason, resubmitLink) => {
  const html = baseTemplate(`
    <h2 class="h2">Attendee Photo Rejected</h2>
    <div class="alert" style="background:#fef2f2; border-left-color:#ef4444; color:#991b1b;">An attendee in your order has their photo rejected.</div>
    
    <p>Dear <strong>${buyer.name || 'Buyer'}</strong>,</p>
    <p>The attendee photo for <strong>${event?.name || 'your event'}</strong> was rejected by the verification team.</p>
    
    <div class="info-row"><span class="info-label">ATTENDEE</span><span class="info-value">${attendee.fullName || attendee.email}</span></div>
    <div class="info-row"><span class="info-label">REASON</span><span class="info-value" style="color: #b91c1c;">${reason}</span></div>
    
    <p style="margin-top: 24px;">We have notified the attendee directly, but you may also share this link with them to speed up the process:</p>
    
    <div style="text-align: center; margin-top: 16px;">
      <a href="${resubmitLink}" class="btn" style="background: #dc2626;">Resubmit Photo Link</a>
    </div>
  `);
  await sendWithProvider({
    to: buyer.email,
    subject: `ENTRYNEX: Photo Rejected for ${attendee.fullName || 'Attendee'} - ${event?.name || 'Event'}`,
    html,
  });
};

const sendBuyerTicketProgressUpdate = async ({
  buyer,
  event,
  attendee,
  ticket,
  order,
  stage,
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const orderUrl = order?.confirmationToken ? `${frontendUrl}/order/${order.confirmationToken}/confirm` : `${frontendUrl}/buyer/orders`;
  const attendeeLabel = attendee?.fullName || attendee?.email || 'Attendee';
  const ticketCategory = ticket?.categoryName || attendee?.categoryName || 'Ticket';

  const stageConfig = {
    invited: {
      subject: `Invite Sent - ${event?.name || 'Event'}`,
      title: 'Invite Sent To Attendee',
      alert: 'The attendee invitation has been sent successfully.',
      message: `${attendeeLabel} has been invited for ${ticketCategory}. We are now waiting for them to confirm their identity.`,
    },
    pending_verification: {
      subject: `Verification Pending - ${event?.name || 'Event'}`,
      title: 'Attendee Submitted Details',
      alert: 'The attendee has completed confirmation. Verification is now pending.',
      message: `${attendeeLabel} has submitted their details for ${ticketCategory}. The ticket will be issued after verification is completed.`,
    },
  };

  const config = stageConfig[stage];
  if (!config || !buyer?.email) return;

  const html = baseTemplate(`
    <h2 class="h2">${config.title}</h2>
    <div class="alert">${config.alert}</div>

    <p>Dear <strong>${buyer.name || 'Buyer'}</strong>,</p>
    <p>${config.message}</p>

    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event?.name || 'Event'}</span></div>
    <div class="info-row"><span class="info-label">Attendee</span><span class="info-value">${attendeeLabel}</span></div>
    <div class="info-row"><span class="info-label">Ticket Category</span><span class="info-value">${ticketCategory}</span></div>
    <div class="info-row"><span class="info-label">Current Status</span><span class="info-value">${stage === 'invited' ? 'Waiting for attendee confirmation' : 'Waiting for organiser verification'}</span></div>

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${orderUrl}">View Ticket Progress</a>
    </div>
  `);

  await sendWithProvider({
    to: buyer.email,
    subject: config.subject,
    html,
  });
};

const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = baseTemplate(`
    <h2 class="h2">Password Reset Request</h2>
    <p>Dear <strong>${user.name}</strong>,</p>
    <p>You are receiving this email because you (or someone else) have requested to reset the password for your account.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${resetUrl}">Reset My Password</a>
    </div>
    
    <p style="font-size:13px; color: #64748b; margin-top: 24px;">
      This link is valid for **1 hour**. If you did not request this, please ignore this email and your password will remain unchanged.
    </p>
  `);

  await sendWithProvider({
    to: user.email,
    subject: 'ENTRYNEX: Password Reset Request',
    html,
  });
};

const sendVerificationEmail = async (user, verifyUrl) => {
  const html = baseTemplate(`
    <h2 class="h2">Verify Your Email</h2>
    <p>Dear <strong>${user.name}</strong>,</p>
    <p>Thank you for registering with ENTRYNEX. Please confirm your email address to activate your account.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${verifyUrl}">Verify Email Address</a>
    </div>
    
    <p style="font-size:13px; color: #64748b; margin-top: 24px;">
      This link is valid for **24 hours**. If you did not create an account, please ignore this email.
    </p>
  `);

  await sendWithProvider({
    to: user.email,
    subject: 'ENTRYNEX: Please verify your email address',
    html,
  });
};

const sendTempPasswordEmail = async (user, tempPassword, loginUrl) => {
  const html = baseTemplate(`
    <h2 class="h2">Welcome to ENTRYNEX</h2>
    <p>Dear <strong>${user.name}</strong>,</p>
    <p>An administrator has created an account for you on the Event Access Management System.</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
      <span class="info-label">YOUR TEMPORARY PASSWORD</span>
      <div style="font-size: 20px; font-weight: 700; color: #0a1128; letter-spacing: 2px;">${tempPassword}</div>
    </div>
    
    <p>Please log in using your email address and the temporary password above. <strong>You will be required to change your password upon your first login.</strong></p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${loginUrl}">Log In Now</a>
    </div>
  `);

  await sendWithProvider({
    to: user.email,
    subject: 'ENTRYNEX: Your Account and Temporary Password',
    html,
  });
};

module.exports = {
  sendOrderConfirmation,
  sendAttendeeInvite,
  sendFinalConfirmation,
  sendBuyerFinalSummary,
  sendConfirmationReminder,
  sendSubOrganiserInvite,
  sendStatusChange,
  sendBuyerPhotoRejection,
  sendBuyerTicketProgressUpdate,
  sendPhotoRejection,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendTempPasswordEmail,
};
