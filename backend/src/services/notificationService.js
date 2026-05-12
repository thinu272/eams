const {
  sendOrderConfirmation,
  sendAttendeeInvite,
  sendBuyerFinalSummary,
  sendConfirmationReminder,
  sendSubOrganiserInvite,
  sendStatusChange,
  sendBuyerPhotoRejection,
  sendBuyerTicketProgressUpdate,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendTempPasswordEmail,
  sendAttendeePendingVerification,
} = require('../utils/email');
const { createShortLink } = require('./shortLinkService');
const { sendSMS } = require('./smsService');
const { sendWhatsApp } = require('./whatsappService');
const { deliverAttendeeTicketEmail, sendBuyerPurchaseSummaryEmail } = require('./ticketDeliveryService');
const SystemConfig = require('../models/SystemConfig');
const Notification = require('../models/Notification');
const User = require('../models/User');

const parseChannels = async (notificationChannel, event = null) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const channels = ['email'];
  
  // SMS Logic: Check Global config and Event settings
  const smsGloballyEnabled = config.sms?.enabled || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  // If event is provided, respect its SMS setting. If not (system level), default to global enable state.
  const smsEventEnabled = event ? (event.settings?.communicationChannels?.sms ?? false) : true;

  if (smsGloballyEnabled && smsEventEnabled) {
    channels.push('sms');
  }
  
  if (config.whatsapp?.enabled) {
    channels.push('whatsapp');
  }
  
  if (notificationChannel === 'email') return channels.filter(c => c === 'email');
  if (notificationChannel === 'sms') return channels.filter(c => c === 'sms');
  if (notificationChannel === 'whatsapp') return channels.filter(c => c === 'whatsapp');
  
  return channels;
};

// Helper function to create persistent notifications
const createNotification = async (userId, title, message, type = 'info', metadata = {}) => {
  try {
    // Ensure userId is valid
    if (!userId) return null;
    
    const notification = new Notification({
      user: userId,
      title,
      message,
      type,
      metadata,
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};


const templateReplace = (template, data) => {
  if (!template) return '';
  return template.replace(/{{(\w+)}}/g, (match, key) => {
    return data[key] || match;
  });
};

const buildShortUrl = async (targetPath, label) => {
  const shortLink = await createShortLink({ targetPath, label });
  return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/t/${shortLink.code}`;
};

const notifyOrderConfirmation = async ({ order, event, buyerPhone, notificationChannel }) => {
  const channels = await parseChannels(notificationChannel, event);
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const tasks = [];

  if (channels.includes('email')) {
    tasks.push(sendBuyerPurchaseSummaryEmail({ order, event }).catch((error) => {
      console.error('ORDER EMAIL ERROR:', error);
    }));
  }

  const shortUrl = await buildShortUrl(`/order/${order.confirmationToken}/confirm`, 'order-confirmation');
  const data = { eventName: event.name, orderNumber: order.orderNumber, shortUrl, buyerName: order.buyerName };

  if (channels.includes('sms') && buyerPhone) {
    const template = config.sms?.templates?.confirmation || 'ENTRYNEX: Order confirmed for {{eventName}}. Confirm tickets here: {{shortUrl}}';
    tasks.push(sendSMS(buyerPhone, templateReplace(template, data), { rateKey: `order:${buyerPhone}` })
      .catch((error) => console.error('ORDER SMS ERROR:', error)));
  }

  if (channels.includes('whatsapp') && buyerPhone) {
    const template = config.whatsapp?.templates?.confirmation || 'Hello! Your order for {{eventName}} is confirmed. Confirm here: {{shortUrl}}';
    tasks.push(sendWhatsApp(buyerPhone, templateReplace(template, data))
      .catch((error) => console.error('ORDER WHATSAPP ERROR:', error)));
  }

  await Promise.all(tasks);
};

const notifyInvite = async ({ attendee, event, phone, email, notificationChannel }) => {
  const channels = await parseChannels(notificationChannel, event);
  const tasks = [];

  const inviteData = {
    attendee,
    event,
    ticketDetails: {
      categoryName: attendee.categoryName,
      price: attendee.price || 'N/A', // Assume price might be passed or exists on attendee
    }
  };

  // Create persistent notification for attendee
  if (attendee?.userId || attendee?._id) {
    const userId = attendee.userId || attendee._id;
    await createNotification(
      userId,
      `Ticket Invitation - ${event.name}`,
      `You are invited to ${event.name} (${attendee.categoryName}). Please confirm your attendance.`,
      'info',
      { attendeeId: attendee._id, eventId: event._id, confirmationToken: attendee.confirmationToken }
    );
  }

  if (channels.includes('email') && email) {
    tasks.push(sendAttendeeInvite(inviteData).catch((error) => {
      console.error('INVITE EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/invite/${attendee.confirmationToken}`, 'invite-link');
        await sendSMS(
          phone,
          `ENTRYNEX: You're invited to ${event.name} (${attendee.categoryName}). Confirm here: ${shortUrl}`,
          { rateKey: `invite:${phone}` }
        );
      } catch (error) {
        console.error('INVITE SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
};

const notifyFinalTicket = async ({ attendee, event, phone, notificationChannel, force = false }) => {
  const channels = await parseChannels(notificationChannel, event);
  let deliveryResult = { delivered: false, skipped: false, reason: null };

  // Create persistent notification for attendee
  if (attendee?.userId || attendee?._id) {
    const userId = attendee.userId || attendee._id;
    await createNotification(
      userId,
      `Ticket Confirmed - ${event.name}`,
      `Your ticket for ${event.name} has been confirmed! Your PDF ticket has been sent to your email.`,
      'success',
      { attendeeId: attendee._id, eventId: event._id }
    );
  }

  if (channels.includes('email')) {
    try {
      deliveryResult = await deliverAttendeeTicketEmail({
        attendee,
        event,
        force,
      });
    } catch (error) {
      console.error('FINAL EMAIL ERROR:', error);
      deliveryResult = { delivered: false, error: error.message };
    }
  }

  // Decoupled SMS: Send SMS if requested, even if email was skipped (e.g. already_sent)
  // Only skip SMS if there was a hard failure in email that suggests we shouldn't proceed
  if (channels.includes('sms') && phone) {
    try {
      await sendSMS(
        phone,
        `ENTRYNEX Ticket Confirmed: ${event.name || 'Event'}. Your PDF ticket has been sent to your email.`,
        { rateKey: `final:${phone}` }
      );
    } catch (error) {
      console.error('FINAL SMS ERROR:', error);
    }
  }

  return deliveryResult;
};

const notifyBuyerFinalSummary = async ({ order, event, attendees }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  const buyerPhone = order.buyerPhone;

  if (channels.includes('email')) {
    tasks.push(sendBuyerFinalSummary({
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      orderNumber: order.orderNumber,
      event,
      attendees,
    }).catch((error) => {
      console.error('BUYER SUMMARY EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && buyerPhone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/order/${order.confirmationToken}/confirm`, 'order-confirmation');
        await sendSMS(
          buyerPhone,
          `ENTRYNEX: All attendees confirmed for ${event.name}. View summary: ${shortUrl}`,
          { rateKey: `buyer-summary:${buyerPhone}` }
        );
      } catch (error) {
        console.error('BUYER SUMMARY SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
};

const notifyConfirmationReminder = async ({ attendee, event, phone, email }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  if (channels.includes('email') && email) {
    tasks.push(sendConfirmationReminder(attendee, event).catch((error) => {
      console.error('REMINDER EMAIL ERROR:', error);
    }));
  }
  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/invite/${attendee.confirmationToken}`, 'invite-reminder');
        await sendSMS(
          phone,
          `ENTRYNEX reminder: Please confirm your ticket for ${event.name}: ${shortUrl}`,
          { rateKey: `reminder:${phone}` }
        );
      } catch (error) {
        console.error('REMINDER SMS ERROR:', error);
      }
    })());
  }
  await Promise.all(tasks);
};

const notifySubOrganiserInvite = async ({ user, event, phone, email }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  if (channels.includes('email') && email) {
    tasks.push(sendSubOrganiserInvite(user, event).catch((error) => {
      console.error('SUB-ORG INVITE EMAIL ERROR:', error);
    }));
  }
  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        await sendSMS(
          phone,
          `ENTRYNEX: You have been invited as Sub-Organiser${event?.name ? ` for ${event.name}` : ''}. Check your email for details.`,
          { rateKey: `suborg:${phone}` }
        );
      } catch (error) {
        console.error('SUB-ORG INVITE SMS ERROR:', error);
      }
    })());
  }
  await Promise.all(tasks);
};

const notifyStatusChange = async ({ attendee, event, status, message }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  
  // Create persistent notification for attendee if user exists
  if (attendee?.userId || attendee?.email) {
    const userId = attendee.userId || attendee._id;
    await createNotification(
      userId,
      `Ticket Status Update`,
      `Your ticket status has been updated to: ${status}. ${message || ''}`.trim(),
      'info',
      { attendeeId: attendee._id, eventId: event._id, status }
    );
  }
  
  if (channels.includes('email') && attendee.email) {
    tasks.push(sendStatusChange(attendee, event, status, message).catch((error) => {
      console.error('STATUS EMAIL ERROR:', error);
    }));
  }
  if (channels.includes('sms') && attendee.phone) {
    tasks.push(sendSMS(
      attendee.phone,
      `ENTRYNEX update: ${status}. ${message || ''}`.trim(),
      { rateKey: `status:${attendee.phone}` }
    ).catch((error) => {
      console.error('STATUS SMS ERROR:', error);
    }));
  }
  await Promise.all(tasks);
};

const notifyPhotoRejection = async ({ attendee, reason, resubmitToken }) => {
  const channels = ['email', 'sms']; // Always send both for rejections
  const tasks = [];
  const event = attendee.event;

  if (channels.includes('email') && attendee.email) {
    const { sendPhotoRejection } = require('../utils/email');
    const resubmitLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/resubmit/${resubmitToken}`;
    tasks.push(sendPhotoRejection(attendee, event, reason, resubmitLink).catch((error) => {
      console.error('REJECTION EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && attendee.phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/resubmit/${resubmitToken}`, 'photo-resubmit');
        await sendSMS(
          attendee.phone,
          `ENTRYNEX: Your photo was rejected. Reason: ${reason}. Please re-upload here: ${shortUrl}`,
          { rateKey: `reject:${attendee.phone}` }
        );
      } catch (error) {
        console.error('REJECTION SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
};

const notifyPhotoRejectionNotification = async ({ attendee, event, reason }) => {
  const resubmitToken = attendee.resubmitToken;
  await notifyPhotoRejection({ attendee, reason, resubmitToken });

  if (attendee.order) {
    const Order = require('../models/Order');
    const order = await Order.findById(attendee.order);
    if (order) {
      const resubmitLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/attendee/resubmit-photo/${resubmitToken}`;
      const buyer = { name: order.buyerName, email: order.buyerEmail, phone: order.buyerPhone };
      
      // Only send buyer notification if buyer email is different from attendee email
      if (buyer.email && buyer.email.toLowerCase() !== attendee.email?.toLowerCase()) {
        await sendBuyerPhotoRejection(buyer, event, attendee, reason, resubmitLink).catch((error) => {
          console.error('BUYER PHOTO REJECTION EMAIL ERROR:', error);
        });
        if (buyer.phone) {
          await sendSMS(
            buyer.phone,
            `ENTRYNEX: Attendee photo rejected for ${event?.name || 'event'}. Reason: ${reason}. Resubmit: ${resubmitLink}`,
            { rateKey: `buyer-reject:${buyer.phone}` }
          ).catch((error) => console.error('BUYER PHOTO REJECTION SMS ERROR:', error));
        }
      }
    }
  }
};

const notifyBuyerTicketProgress = async ({
  order,
  attendee,
  event,
  ticket,
  stage,
}) => {
  if (!order?.buyerEmail || !stage) return;

  // Create persistent notification for buyer
  if (order.buyerId) {
    const stageMessages = {
      'invited': `Attendee invitation sent for ${attendee?.fullName || 'Attendee'}`,
      'confirmed': `Ticket confirmed for ${attendee?.fullName || 'Attendee'}`,
      'verified': `Photo verified for ${attendee?.fullName || 'Attendee'}`,
      'completed': `All tickets confirmed and ready!`,
    };
    
    await createNotification(
      order.buyerId,
      `Ticket Progress Update - ${event.name}`,
      stageMessages[stage] || `Ticket status updated: ${stage}`,
      'info',
      { orderId: order._id, attendeeId: attendee?._id, eventId: event._id, stage }
    );
  }

  await sendBuyerTicketProgressUpdate({
    buyer: {
      name: order.buyerName,
      email: order.buyerEmail,
      phone: order.buyerPhone,
    },
    event,
    attendee,
    ticket,
    order,
    stage,
  }).catch((error) => {
    console.error('BUYER PROGRESS EMAIL ERROR:', error);
  });
};

const notifyUserCredentials = async (user, tempPassword) => {
  console.log(`NOTIFY: Sending credentials to ${user.email} with temp password ${tempPassword}`);
  const tasks = [];
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

  const emailResult = await sendTempPasswordEmail(user, tempPassword, loginUrl);

  if (user.phone) {
    tasks.push(sendSMS(
      user.phone,
      `ENTRYNEX: Your account has been created. Temp Password: ${tempPassword}. Login at: ${loginUrl}`,
      { rateKey: `creds:${user.phone}` }
    ).catch(err => console.error('CREDENTIALS SMS ERROR:', err)));
  }

  await Promise.all(tasks);
  return { email: emailResult, smsQueued: tasks.length > 0 };
};

const notifyVerification = async (user, verifyUrl) => {
  await sendVerificationEmail(user, verifyUrl).catch(err => console.error('VERIFICATION EMAIL ERROR:', err));
};

const notifyPasswordReset = async (user, resetUrl) => {
  await sendPasswordResetEmail(user, resetUrl).catch(err => console.error('RESET EMAIL ERROR:', err));
};

const notifyOTP = async (phone, otp) => {
  await sendSMS(
    phone,
    `ENTRYNEX: Your security code is ${otp}. It expires in 5 minutes.`,
    { rateKey: `otp:${phone}` }
  );
};

const notifyRoleAssignment = async (user, newRole, assignedEvents = []) => {
  await require('../utils/email').sendRoleAssignmentEmail(user, newRole, assignedEvents).catch(err => console.error('ROLE EMAIL ERROR:', err));
  
  if (user.phone) {
    await sendSMS(
      user.phone,
      `ENTRYNEX: Your account role has been updated to ${newRole}. Log in to view changes.`,
      { rateKey: `role:${user.phone}` }
    ).catch(err => console.error('ROLE SMS ERROR:', err));
  }
};

module.exports = {
  notifyOrderConfirmation,
  notifyInvite,
  notifyFinalTicket,
  notifyBuyerFinalSummary,
  notifyConfirmationReminder,
  notifySubOrganiserInvite,
  notifyStatusChange,
  notifyPhotoRejection,
  notifyPhotoRejectionNotification,
  notifyBuyerTicketProgress,
  notifyUserCredentials,
  notifyVerification,
  notifyPasswordReset,
  notifyOTP,
  notifyRoleAssignment,
};

const notifyAttendeePendingVerification = async ({ attendee, event }) => {
  if (!attendee?.email) return;

  // Send email to attendee
  await sendAttendeePendingVerification(attendee, event).catch((error) => {
    console.error('ATTENDEE PENDING VERIFICATION EMAIL ERROR:', error);
  });
};

module.exports = {
  notifyOrderConfirmation,
  notifyInvite,
  notifyFinalTicket,
  notifyBuyerFinalSummary,
  notifyConfirmationReminder,
  notifySubOrganiserInvite,
  notifyStatusChange,
  notifyPhotoRejection,
  notifyPhotoRejectionNotification,
  notifyBuyerTicketProgress,
  notifyUserCredentials,
  notifyVerification,
  notifyPasswordReset,
  notifyOTP,
  notifyRoleAssignment,
  notifyAttendeePendingVerification,
  parseChannels,
  createNotification,
};
