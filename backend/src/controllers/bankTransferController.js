'use strict';

const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const Order = require('../models/Order');
const PaymentSubmission = require('../models/PaymentSubmission');
const BankAccount = require('../models/BankAccount');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');

const {
  sendBankTransferPaymentSubmitted,
  sendBankTransferPaymentApproved,
} = require('../utils/email');
const { sendBuyerPurchaseSummaryEmail } = require('../services/ticketDeliveryService');
const { sendSMS } = require('../services/smsService');
const { logActivity, logger } = require('../utils/logger'); // assumes logger export alongside logActivity
const { emitDashboardEvent } = require('../utils/socket');

// Fields an admin is allowed to set directly on a bank account record.
const BANK_ACCOUNT_WRITABLE_FIELDS = [
  'bankName', 'accountName', 'accountNumber', 'branch', 'swiftCode', 'qrCode', 'isActive', 'eventId',
];

function pick(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
}

// ---------------------------------------------------------------------------
// File uploads
// ---------------------------------------------------------------------------

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
    cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
  },
});

module.exports.upload = upload;

// ---------------------------------------------------------------------------
// Create order (bank transfer)
// ---------------------------------------------------------------------------

// Creates the order + its reserved tickets atomically, pricing every ticket
// from the event's own category data (never from the request body), and
// only reserving tickets if enough inventory remains.
exports.createBankTransferOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { eventId, buyerName, buyerEmail, buyerPhone, notificationChannel, tickets } = req.body;

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ message: 'At least one ticket is required.' });
    }

    let createdOrder;

    await session.withTransaction(async () => {
      const event = await Event.findById(eventId).session(session);
      if (!event) {
        throw Object.assign(new Error('Event not found'), { statusCode: 404 });
      }

      let totalAmount = 0;
      const ticketsToCreate = [];
      let slotIndex = 1;

      for (const requested of tickets) {
        const category = event.categories.find((cat) => cat.name === requested.categoryName);
        if (!category) {
          throw Object.assign(new Error(`Invalid ticket category: ${requested.categoryName}`), { statusCode: 400 });
        }

        const quantity = Number(requested.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw Object.assign(new Error(`Invalid quantity for category: ${requested.categoryName}`), { statusCode: 400 });
        }

        // ASSUMPTION: category total capacity field is `quantity` — confirm
        // against the real Event schema and rename if it's actually
        // `capacity` / `totalTickets` / etc.
        const reserved = await Event.findOneAndUpdate(
          {
            _id: eventId,
            categories: {
              $elemMatch: {
                name: requested.categoryName,
                $expr: { $lte: [{ $add: ['$sold', quantity] }, '$quantity'] },
              },
            },
          },
          { $inc: { 'categories.$.sold': quantity } },
          { new: true, session }
        );

        if (!reserved) {
          throw Object.assign(
            new Error(`Not enough tickets available for category: ${requested.categoryName}`),
            { statusCode: 409 }
          );
        }

        const price = category.price; // priced from the event, never trusted from req.body
        totalAmount += price * quantity;

        for (let i = 0; i < quantity; i++) {
          ticketsToCreate.push({
            categoryId: category.id,
            categoryName: requested.categoryName,
            allowedZones: category.allowedZones || [],
            price,
            slotIndex: slotIndex++,
          });
        }
      }

      const reservationExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const [order] = await Order.create(
        [{
          eventId,
          buyerId: req.user?._id, // undefined for guest checkout
          buyerName,
          buyerEmail,
          buyerPhone,
          notificationChannel,
          tickets,
          totalAmount,
          paymentMethod: 'bank_transfer',
          paymentStatus: 'pending',
          status: 'PENDING_PAYMENT',
          reservationExpiry,
        }],
        { session }
      );

      const ticketDocs = ticketsToCreate.map((t) => ({
        order: order._id,
        event: eventId,
        ...t,
        status: 'RESERVED',
        ticketNumber: `${order.orderNumber}-${t.slotIndex}`,
        qrCode: null,
      }));

      await Ticket.insertMany(ticketDocs, { session });

      createdOrder = order;
    });

    res.status(201).json({
      message: 'Order created successfully',
      data: {
        orderId: createdOrder._id,
        orderNumber: createdOrder.orderNumber,
        confirmationToken: createdOrder.confirmationToken,
        reservationExpiry: createdOrder.reservationExpiry,
      },
    });
  } catch (error) {
    logger.error(`Error creating bank transfer order: ${error.message}`);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Failed to create order' });
  } finally {
    session.endSession();
  }
};

// ---------------------------------------------------------------------------
// Get bank transfer instructions
// ---------------------------------------------------------------------------

exports.getBankTransferInstructions = async (req, res) => {
  const { orderIdOrToken } = req.params;

  try {
    let order = await Order.findOne({ confirmationToken: orderIdOrToken }).populate('eventId');

    if (!order && orderIdOrToken.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderIdOrToken).populate('eventId');
    }

    if (!order) {
      logger.warn(`Order not found for: ${orderIdOrToken}`);
      return res.status(404).json({ message: 'The requested order could not be found' });
    }

    if (order.paymentMethod !== 'bank_transfer') {
      logger.warn(`Attempted to get bank instructions for non-bank transfer order: ${orderIdOrToken}`);
      return res.status(400).json({ message: 'This order does not utilize the bank transfer payment method' });
    }

    const eventScopedAccounts = await BankAccount.find({
      isActive: true,
      eventId: order.eventId?._id || order.eventId,
    });

    const bankAccounts = eventScopedAccounts.length > 0
      ? eventScopedAccounts
      : await BankAccount.find({ isActive: true });

    res.status(200).json({
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          confirmationToken: order.confirmationToken,
          eventName: order.eventId?.name,
          tickets: order.tickets,
          totalAmount: order.totalAmount,
          reservationExpiry: order.reservationExpiry,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
        bankAccounts,
      },
    });
  } catch (error) {
    logger.error(`Error retrieving bank transfer instructions for ${orderIdOrToken}: ${error.message}`);
    res.status(500).json({ message: 'An internal error occurred while fetching bank transfer instructions' });
  }
};

// ---------------------------------------------------------------------------
// Submit payment receipt
// ---------------------------------------------------------------------------

exports.submitPaymentReceipt = async (req, res) => {
  try {
    const { orderIdOrToken } = req.params;
    const {
      payerName, payerEmail, payerPhone, payerNicPassport,
      bankUsed, transferDate, transferTime, referenceNumber, amountPaid, notes,
    } = req.body;

    let order = await Order.findOne({ confirmationToken: orderIdOrToken });
    if (!order && orderIdOrToken.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderIdOrToken);
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({ message: 'This order is not a bank transfer order' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required' });
    }

    const event = await Event.findById(order.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const receiptFileType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';

    const submission = await PaymentSubmission.create({
      orderId: order._id,
      eventId: order.eventId, // NOTE: requires PaymentSubmission schema update
      payerName,
      payerEmail,
      payerPhone,
      payerNicPassport,
      bankUsed,
      transferDate,
      transferTime,
      referenceNumber,
      amountPaid,
      receiptFile: req.file.path,
      receiptFileType,
      notes,
      verificationStatus: 'pending',
    });

    order.paymentStatus = 'pending_verification';
    order.status = 'PENDING_VERIFICATION';
    await order.save();

    try {
      await sendBankTransferPaymentSubmitted(order, event, submission);
    } catch (emailErr) {
      logger.error(`Error sending payment submitted email: ${emailErr.message}`);
    }

    if (payerPhone) {
      try {
        await sendSMS(
          payerPhone,
          `ENTRYNEX: We have received your bank transfer submission. Your payment is currently being verified. You will receive another notification once your order has been confirmed. Order: ${order.orderNumber}`
        );
      } catch (smsErr) {
        logger.error(`Error sending submission SMS: ${smsErr.message}`);
      }
    }

    if (order.buyerId) {
      try {
        await Notification.create({
          user: order.buyerId,
          recipientEmail: order.buyerEmail,
          title: 'Payment Awaiting Verification',
          message: `Your payment for order ${order.orderNumber} is awaiting verification.`,
          type: 'info',
        });
      } catch (notifErr) {
        logger.error(`Error creating in-app notification: ${notifErr.message}`);
      }
    }

    try {
      const io = req.app.get('io');
      emitDashboardEvent(io, 'event_update', order.eventId?._id || order.eventId, {
        type: 'PAYMENT_SUBMITTED',
        eventId: order.eventId?._id || order.eventId,
        orderId: order._id,
        paymentMethod: 'bank_transfer',
        paymentStatus: order.paymentStatus,
      });
    } catch (socketErr) {
      logger.error(`Error broadcasting payment submission event: ${socketErr.message}`);
    }

    res.status(201).json({
      message: 'Payment submitted successfully',
      data: { submissionId: submission._id, orderNumber: order.orderNumber, verificationStatus: 'pending' },
    });
  } catch (error) {
    logger.error(`Error submitting payment receipt: ${error.message}`);
    res.status(500).json({ message: 'Failed to submit payment' });
  }
};

// ---------------------------------------------------------------------------
// Organiser: list / approve / reject / request info
// ---------------------------------------------------------------------------

exports.getPendingPayments = async (req, res) => {
  try {
    const { status, eventId } = req.query;

    const filter = { verificationStatus: status || 'pending' };
    if (eventId) filter.eventId = eventId; // now filters directly on PaymentSubmission.eventId

    const submissions = await PaymentSubmission.find(filter)
      .populate('orderId')
      .populate('verifiedBy', 'name email')
      .sort({ submittedAt: -1 });

    res.status(200).json({ data: submissions });
  } catch (error) {
    logger.error(`Error getting pending payments: ${error.message}`);
    res.status(500).json({ message: 'Failed to get payments' });
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { notes } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid submission ID.' });
    }

    const paymentSubmission = await PaymentSubmission.findById(submissionId).populate('orderId');
    if (!paymentSubmission) return res.status(404).json({ message: 'Payment submission not found.' });
    if (paymentSubmission.verificationStatus === 'approved') {
      return res.status(400).json({ message: 'Payment is already approved.' });
    }

    paymentSubmission.verificationStatus = 'approved';
    paymentSubmission.verifiedBy = user._id;
    paymentSubmission.verifiedAt = new Date();
    paymentSubmission.notes = notes || paymentSubmission.notes;
    await paymentSubmission.save();

    const order = await Order.findById(paymentSubmission.orderId._id).populate('eventId');
    if (!order) {
      return res.status(200).json({
        message: 'Payment approved successfully',
        data: { submissionId: paymentSubmission._id, verificationStatus: 'approved' },
      });
    }

    order.status = 'CONFIRMED';
    order.paymentStatus = 'success';
    await order.save();

    await Ticket.updateMany({ order: order._id }, { status: 'SOLD' });

    const tickets = await Ticket.find({ order: order._id }).populate('attendee');
    for (const ticket of tickets) {
      if (ticket.attendee) {
        ticket.attendee.confirmationStatus = 'confirmed';
        ticket.attendee.isConfirmed = true;
        await ticket.attendee.save();
      }
      if (!ticket.qrCode) {
        ticket.qrCode = await QRCode.toDataURL(ticket.ticketNumber);
        await ticket.save();
      }
    }

    try {
      await sendBankTransferPaymentApproved(order, order.eventId);
      await sendBuyerPurchaseSummaryEmail({ order, event: order.eventId });

      if (order.buyerPhone) {
        try {
          await sendSMS(
            order.buyerPhone,
            `ENTRYNEX: Your payment has been approved. Your order ${order.orderNumber} is confirmed. Please complete your attendee details through your ENTRYNEX account.`
          );
        } catch (smsErr) {
          logger.error(`Error sending approval SMS: ${smsErr.message}`);
        }
      }

      if (order.buyerId) {
        await Notification.create({
          user: order.buyerId,
          recipientEmail: order.buyerEmail,
          title: 'Payment Approved - Order Confirmed',
          message: `Your payment for order ${order.orderNumber} has been approved. Your tickets are now confirmed and you can access all ticket features.`,
          type: 'success',
          metadata: { orderId: order._id, submissionId: paymentSubmission._id },
        });
      }
    } catch (notificationError) {
      logger.error(`Notification error: ${notificationError.message}`);
    }

    await logActivity({
      req,
      action: 'payment_approval',
      eventId: order.eventId?._id,
      details: {
        message: `Payment approved for order ${order.orderNumber}`,
        submissionId: paymentSubmission._id,
        amount: paymentSubmission.amountPaid,
        approvedBy: user.name,
      },
    });

    const io = req.app.get('io');
    emitDashboardEvent(io, 'payment_approved', order.eventId?._id, {
      orderId: order._id,
      submissionId: paymentSubmission._id,
      amount: paymentSubmission.amountPaid,
    });
    emitDashboardEvent(io, 'event_update', order.eventId?._id, {
      type: 'PAYMENT_APPROVED',
      eventId: order.eventId?._id,
      orderId: order._id,
      submissionId: paymentSubmission._id,
    });

    res.status(200).json({
      message: 'Payment approved successfully',
      data: { submissionId: paymentSubmission._id, orderNumber: order.orderNumber, verificationStatus: 'approved' },
    });
  } catch (error) {
    logger.error(`Error approving payment: ${error.message}`);
    res.status(500).json({ message: 'Failed to approve payment' });
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { rejectionReason } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid submission ID.' });
    }
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ message: 'Rejection reason is required.' });
    }

    const paymentSubmission = await PaymentSubmission.findById(submissionId).populate('orderId');
    if (!paymentSubmission) return res.status(404).json({ message: 'Payment submission not found.' });
    if (paymentSubmission.verificationStatus === 'rejected') {
      return res.status(400).json({ message: 'Payment is already rejected.' });
    }

    paymentSubmission.verificationStatus = 'rejected';
    paymentSubmission.verifiedBy = user._id;
    paymentSubmission.verifiedAt = new Date();
    paymentSubmission.rejectionReason = rejectionReason.trim();
    await paymentSubmission.save();

    const order = await Order.findById(paymentSubmission.orderId._id).populate('eventId');
    if (order) {
      order.status = 'CANCELLED';
      order.paymentStatus = 'rejected';
      await order.save();

      await Ticket.updateMany({ order: order._id }, { status: 'CANCELLED' });

      try {
        if (order.buyerId) {
          await Notification.create({
            user: order.buyerId,
            recipientEmail: order.buyerEmail,
            title: 'Payment Rejected',
            message: `Your payment for order ${order.orderNumber} has been rejected. Reason: ${rejectionReason}`,
            type: 'error',
            metadata: { orderId: order._id, submissionId: paymentSubmission._id, rejectionReason },
          });
        }
      } catch (notificationError) {
        logger.error(`Notification error: ${notificationError.message}`);
      }

      await logActivity({
        req,
        action: 'payment_rejection',
        eventId: order.eventId?._id,
        details: {
          message: `Payment rejected for order ${order.orderNumber}`,
          submissionId: paymentSubmission._id,
          amount: paymentSubmission.amountPaid,
          rejectedBy: user.name,
          rejectionReason,
        },
      });

      const io = req.app.get('io');
      emitDashboardEvent(io, 'payment_rejected', order.eventId?._id, {
        orderId: order._id,
        submissionId: paymentSubmission._id,
        amount: paymentSubmission.amountPaid,
        rejectionReason,
      });
      emitDashboardEvent(io, 'event_update', order.eventId?._id, {
        type: 'PAYMENT_REJECTED',
        eventId: order.eventId?._id,
        orderId: order._id,
        submissionId: paymentSubmission._id,
      });
    }

    res.status(200).json({
      message: 'Payment rejected successfully',
      data: {
        submissionId: paymentSubmission._id,
        orderNumber: order?.orderNumber,
        verificationStatus: 'rejected',
        rejectionReason,
      },
    });
  } catch (error) {
    logger.error(`Error rejecting payment: ${error.message}`);
    res.status(500).json({ message: 'Failed to reject payment' });
  }
};

exports.requestMoreInfo = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { message } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid submission ID.' });
    }
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const paymentSubmission = await PaymentSubmission.findById(submissionId).populate('orderId');
    if (!paymentSubmission) return res.status(404).json({ message: 'Payment submission not found.' });

    paymentSubmission.verificationStatus = 'needs_info';
    paymentSubmission.notes = message.trim();
    await paymentSubmission.save();

    const order = await Order.findById(paymentSubmission.orderId._id).populate('eventId');
    if (order) {
      try {
        if (order.buyerId) {
          await Notification.create({
            user: order.buyerId,
            recipientEmail: order.buyerEmail,
            title: 'Payment Information Requested',
            message: `Additional information is required for your payment for order ${order.orderNumber}: ${message}`,
            type: 'info',
            metadata: { orderId: order._id, submissionId: paymentSubmission._id },
          });
        }
      } catch (notificationError) {
        logger.error(`Notification error: ${notificationError.message}`);
      }

      await logActivity({
        req,
        action: 'payment_info_request',
        eventId: order.eventId?._id,
        details: {
          message: `Information requested for order ${order.orderNumber}`,
          submissionId: paymentSubmission._id,
          requestedBy: user.name,
          infoRequest: message,
        },
      });
    }

    res.status(200).json({
      message: 'Information request sent successfully',
      data: { submissionId: paymentSubmission._id, verificationStatus: 'needs_info' },
    });
  } catch (error) {
    logger.error(`Error requesting more info: ${error.message}`);
    res.status(500).json({ message: 'Failed to request information' });
  }
};

// ---------------------------------------------------------------------------
// Bank accounts (admin)
// ---------------------------------------------------------------------------

exports.getBankAccounts = async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find().sort({ createdAt: -1 });
    res.status(200).json({ data: bankAccounts });
  } catch (error) {
    logger.error(`Error getting bank accounts: ${error.message}`);
    res.status(500).json({ message: 'Failed to get bank accounts' });
  }
};

exports.createBankAccount = async (req, res) => {
  try {
    const payload = pick(req.body, BANK_ACCOUNT_WRITABLE_FIELDS);
    const bankAccount = await BankAccount.create({ ...payload, createdBy: req.user._id });
    res.status(201).json({ message: 'Bank account created successfully', data: bankAccount });
  } catch (error) {
    logger.error(`Error creating bank account: ${error.message}`);
    res.status(500).json({ message: 'Failed to create bank account' });
  }
};

exports.updateBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const payload = pick(req.body, BANK_ACCOUNT_WRITABLE_FIELDS);

    const bankAccount = await BankAccount.findByIdAndUpdate(
      accountId,
      { ...payload, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!bankAccount) return res.status(404).json({ message: 'Bank account not found' });
    res.status(200).json({ message: 'Bank account updated successfully', data: bankAccount });
  } catch (error) {
    logger.error(`Error updating bank account: ${error.message}`);
    res.status(500).json({ message: 'Failed to update bank account' });
  }
};

exports.deleteBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const bankAccount = await BankAccount.findByIdAndDelete(accountId);
    if (!bankAccount) return res.status(404).json({ message: 'Bank account not found' });
    res.status(200).json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting bank account: ${error.message}`);
    res.status(500).json({ message: 'Failed to delete bank account' });
  }
};