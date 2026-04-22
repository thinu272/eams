const {
  sendOrderConfirmation,
  sendAttendeeInvite,
  sendFinalConfirmation,
  sendBuyerFinalSummary,
  sendConfirmationReminder,
  sendSubOrganiserInvite,
  sendStatusChange,
  sendBuyerPhotoRejection,
} = require('../utils/email');
const { createShortLink } = require('./shortLinkService');
const { sendSMS } = require('./smsService');

const parseChannels = (notificationChannel) => {
  // EAMS Phase 1: Always send Email + SMS when possible.
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
    tasks.push(sendOrderConfirmation(order, event).catch((error) => {
      console.error('ORDER EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && buyerPhone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/order/${order.confirmationToken}/confirm`, 'order-confirmation');
        await sendSMS(
          buyerPhone,
          `EAMS: Order confirmed for ${event.name}. Confirm tickets here: ${shortUrl}`,
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

  if (channels.includes('email') && email) {
    tasks.push(sendAttendeeInvite(attendee, event).catch((error) => {
      console.error('INVITE EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/invite/${attendee.confirmationToken}`, 'invite-link');
        await sendSMS(
          phone,
          `EAMS: You're invited to ${event.name}. Confirm here: ${shortUrl}`,
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
  const tasks = [];

  if (channels.includes('email')) {
    tasks.push(sendFinalConfirmation(attendee, event).catch((error) => {
      console.error('FINAL EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/ticket/${attendee.confirmationToken}`, 'final-ticket');
        await sendSMS(
          phone,
          `EAMS: Ticket confirmed for ${event.name}. Show QR at entry: ${shortUrl}`,
          { rateKey: `final:${phone}` }
        );
      } catch (error) {
        console.error('FINAL SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
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
          `EAMS: All attendees confirmed for ${event.name}. View summary: ${shortUrl}`,
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
          `EAMS reminder: Please confirm your ticket for ${event.name}: ${shortUrl}`,
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
          `EAMS: You have been invited as Sub-Organiser${event?.name ? ` for ${event.name}` : ''}. Check your email for details.`,
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
      `EAMS update: ${status}. ${message || ''}`.trim(),
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
          `Your photo was rejected ❌. Reason: ${reason}. Please re-upload here: ${shortUrl}`,
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
          `EAMS: Attendee photo rejected for ${event?.name || 'event'}. Reason: ${reason}. Resubmit: ${resubmitLink}`,
          { rateKey: `buyer-reject:${buyer.phone}` }
        ).catch((error) => console.error('BUYER PHOTO REJECTION SMS ERROR:', error));
      }
    }
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
  parseChannels,
};
