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
} = require('../utils/email');
const { createShortLink } = require('./shortLinkService');
const { sendSMS } = require('./smsService');
const { deliverAttendeeTicketEmail, sendBuyerPurchaseSummaryEmail } = require('./ticketDeliveryService');

const parseChannels = (notificationChannel) => {
  // ENTRYNEX Phase 1: Always send Email + SMS when possible.
  return ['email', 'sms'];
};

const buildShortUrl = async (targetPath, label) => {
  const shortLink = await createShortLink({ targetPath, label });
  return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/t/${shortLink.code}`;
};

const notifyOrderConfirmation = async ({ order, event, buyerPhone, notificationChannel }) => {
  const channels = parseChannels(notificationChannel);
  const tasks = [];

  if (channels.includes('email')) {
    tasks.push(sendBuyerPurchaseSummaryEmail({ order, event }).catch((error) => {
      console.error('ORDER EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && buyerPhone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/order/${order.confirmationToken}/confirm`, 'order-confirmation');
        await sendSMS(
          buyerPhone,
          `ENTRYNEX: Order confirmed for ${event.name}. Confirm tickets here: ${shortUrl}`,
          { rateKey: `order:${buyerPhone}` }
        );
      } catch (error) {
        console.error('ORDER SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
};

const notifyInvite = async ({ attendee, event, phone, email, notificationChannel }) => {
  const channels = parseChannels(notificationChannel);
  const tasks = [];

  const inviteData = {
    attendee,
    event,
    ticketDetails: {
      categoryName: attendee.categoryName,
      price: attendee.price || 'N/A', // Assume price might be passed or exists on attendee
    }
  };

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

const notifyFinalTicket = async ({ attendee, event, phone, notificationChannel }) => {
  const channels = parseChannels(notificationChannel);
  let deliveryResult = { delivered: false, skipped: true, reason: 'email_not_requested' };

  if (channels.includes('email')) {
    try {
      deliveryResult = await deliverAttendeeTicketEmail({
        attendee,
        event,
      });
    } catch (error) {
      console.error('FINAL EMAIL ERROR:', error);
    }
  }

  if (deliveryResult.delivered && channels.includes('sms') && phone) {
    try {
      await sendSMS(
        phone,
        `ENTRYNEX Ticket Confirmed: ${event.name}. Your PDF ticket has been sent to your email.`,
        { rateKey: `final:${phone}` }
      );
    } catch (error) {
      console.error('FINAL SMS ERROR:', error);
    }
  }

  return deliveryResult;
};

const notifyBuyerFinalSummary = async ({ order, event, attendees }) => {
  const channels = parseChannels('both');
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
  const channels = parseChannels('both');
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
  const channels = parseChannels('both');
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
  const channels = parseChannels('both');
  const tasks = [];
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
};

const notifyBuyerTicketProgress = async ({
  order,
  attendee,
  event,
  ticket,
  stage,
}) => {
  if (!order?.buyerEmail || !stage) return;

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
  const tasks = [];
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

  tasks.push(sendTempPasswordEmail(user, tempPassword, loginUrl).catch(err => console.error('CREDENTIALS EMAIL ERROR:', err)));

  if (user.phone) {
    tasks.push(sendSMS(
      user.phone,
      `ENTRYNEX: Your account has been created. Temp Password: ${tempPassword}. Login at: ${loginUrl}`,
      { rateKey: `creds:${user.phone}` }
    ).catch(err => console.error('CREDENTIALS SMS ERROR:', err)));
  }

  await Promise.all(tasks);
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
  parseChannels,
};
