const { sendOrderConfirmation, sendAttendeeInvite, sendFinalConfirmation } = require('../utils/email');
const { createShortLink } = require('./shortLinkService');
const { sendSMS } = require('./smsService');

const parseChannels = (notificationChannel) => {
  const value = (notificationChannel || 'email').toString().toLowerCase();
  if (value === 'both') return ['email', 'sms'];
  if (value === 'sms') return ['sms'];
  return ['email'];
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
        const shortUrl = await buildShortUrl(`/confirm/${order.confirmationToken}`, 'order-confirmation');
        await sendSMS(
          buyerPhone,
          `Your tickets are booked. Complete confirmation here: ${shortUrl}`,
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
          `You are invited to an event. Confirm here: ${shortUrl}`,
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
          `Your ticket is confirmed. Show this QR at entry: ${shortUrl}`,
          { rateKey: `final:${phone}` }
        );
      } catch (error) {
        console.error('FINAL SMS ERROR:', error);
      }
    })());
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

module.exports = { notifyOrderConfirmation, notifyInvite, notifyFinalTicket, notifyPhotoRejection, parseChannels };
