const mongoose = require('mongoose');
const Order = require('../models/Order');
const PaymentSubmission = require('../models/PaymentSubmission');
const BankAccount = require('../models/BankAccount');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Notification = require('../models/Notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendWithProvider, baseTemplate, sendFinalConfirmation } = require('../utils/email');
const { sendSMS } = require('../services/smsService');
const QRCode = require('qrcode');
const { logActivity } = require('../utils/logger');
const { emitDashboardEvent } = require('../utils/socket');
const { notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/receipts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
    }
  }
});

module.exports.upload = upload;

// Create order with bank transfer payment method
exports.createBankTransferOrder = async (req, res) => {
  try {
    const { eventId, buyerName, buyerEmail, buyerPhone, notificationChannel, tickets } = req.body;

    // Validate event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Calculate total amount
    let totalAmount = 0;
    tickets.forEach(ticket => {
      totalAmount += ticket.price * ticket.quantity;
    });

    // Set reservation expiry (48 hours from now)
    const reservationExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const order = new Order({
      eventId,
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
    });

    await order.save();

    res.status(201).json({
      message: 'Order created successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        confirmationToken: order.confirmationToken,
        reservationExpiry: order.reservationExpiry,
      },
    });
  } catch (error) {
    console.error('Error creating bank transfer order:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
};

// Get bank transfer instructions
exports.getBankTransferInstructions = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`Fetching bank transfer instructions for order ID: ${orderId}`);

    const order = await Order.findById(orderId).populate('eventId');
    if (!order) {
      console.warn(`Order not found for ID: ${orderId}`);
      return res.status(404).json({ message: 'The requested order could not be found' });
    }

    if (order.paymentMethod !== 'bank_transfer') {
      console.warn(`Attempted to get bank instructions for non-bank transfer order: ${orderId}`);
      return res.status(400).json({ message: 'This order does not utilize the bank transfer payment method' });
    }

    // Get active bank accounts
    const bankAccounts = await BankAccount.find({ isActive: true });

    res.status(200).json({
      data: {
        order: {
          orderNumber: order.orderNumber,
          eventName: order.eventId.name,
          tickets: order.tickets,
          totalAmount: order.totalAmount,
          reservationExpiry: order.reservationExpiry,
        },
        bankAccounts,
      },
    });
  } catch (error) {
    console.error(`Error retrieving bank transfer instructions for order ${req.params.orderId}:`, error);
    res.status(500).json({ message: 'An internal error occurred while fetching bank transfer instructions', error: error.message });
  }
};

// Submit payment receipt
exports.submitPaymentReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      payerName,
      payerEmail,
      payerPhone,
      payerNicPassport,
      bankUsed,
      transferDate,
      transferTime,
      referenceNumber,
      amountPaid,
      notes,
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({ message: 'This order is not a bank transfer order' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required' });
    }

    // Determine file type
    const receiptFileType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';

    // Create payment submission
    const submission = new PaymentSubmission({
      orderId,
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

    await submission.save();

    // Update order status
    order.paymentStatus = 'pending_verification';
    order.status = 'PENDING_VERIFICATION';
    await order.save();

    // Send email notification
    try {
      const emailHtml = baseTemplate(`
        <h2>Payment Submission Received</h2>
        <p>Dear ${payerName},</p>
        <p>We have successfully received your bank transfer payment details for order <strong>#${order.orderNumber}</strong>.</p>
        <p>Our verification team will review your receipt and confirm your payment within the next 48 hours.</p>
        <div style="margin: 20px 0; padding: 15px; bg-color: #f1f5f9; border-radius: 8px;">
          <strong>Order Reference:</strong> ${order.orderNumber}<br/>
          <strong>Amount Paid:</strong> ${amountPaid}<br/>
          <strong>Transfer Date/Time:</strong> ${transferDate} ${transferTime}<br/>
          <strong>Status:</strong> Payment Pending Verification
        </div>
        <p>If you have any questions, please contact our support team at support@entrynex.com.</p>
      `, 'Payment Pending Verification');

      await sendWithProvider({
        to: payerEmail,
        subject: `We Have Received Your Bank Transfer Submission - #${order.orderNumber}`,
        html: emailHtml,
      });
    } catch (emailErr) {
      console.error('Error sending submission confirmation email:', emailErr);
    }

    // Send SMS notification
    if (payerPhone) {
      try {
        await sendSMS(
          payerPhone,
          `ENTRYNEX: Payment received. Reference: ${order.orderNumber}. We will verify within 48 hours.`
        );
      } catch (smsErr) {
        console.error('Error sending submission SMS:', smsErr);
      }
    }

    // In-app Notification
    if (order.buyerId) {
      try {
        const notif = new Notification({
          user: order.buyerId,
          title: 'Payment Awaiting Verification',
          message: `Your payment for order ${order.orderNumber} is awaiting verification.`,
          type: 'info',
        });
        await notif.save();
      } catch (notifErr) {
        console.error('Error creating in-app notification:', notifErr);
      }
    }

    res.status(201).json({
      message: 'Payment submitted successfully',
      data: {
        submissionId: submission._id,
        orderNumber: order.orderNumber,
        verificationStatus: 'pending',
      },
    });
  } catch (error) {
    console.error('Error submitting payment receipt:', error);
    res.status(500).json({ message: 'Failed to submit payment', error: error.message });
  }
};

// Get pending payment submissions for organizers
exports.getPendingPayments = async (req, res) => {
  try {
    const { status, eventId } = req.query;
    
    const filter = { verificationStatus: status || 'pending' };
    if (eventId) {
      filter.eventId = eventId;
    }

    const submissions = await PaymentSubmission.find(filter)
      .populate('orderId')
      .populate('verifiedBy', 'name email')
      .sort({ submittedAt: -1 });

    res.status(200).json({ data: submissions });
  } catch (error) {
    console.error('Error getting pending payments:', error);
    res.status(500).json({ message: 'Failed to get payments', error: error.message });
  }
};

// Approve payment
exports.approvePayment = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { notes } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid submission ID.' });
    }

    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ message: 'Payment submission not found.' });
    }

    if (paymentSubmission.verificationStatus === 'approved') {
      return res.status(400).json({ message: 'Payment is already approved.' });
    }

    // Update payment submission
    paymentSubmission.verificationStatus = 'approved';
    paymentSubmission.verifiedBy = user._id;
    paymentSubmission.verifiedAt = new Date();
    paymentSubmission.notes = notes || paymentSubmission.notes;
    await paymentSubmission.save();
    
    // Update order status
    const order = await Order.findById(paymentSubmission.orderId._id)
      .populate('eventId');
    
    if (order) {
      order.status = 'CONFIRMED';
      order.paymentStatus = 'success';
      await order.save();
      
      // Update ticket statuses
      await Ticket.updateMany(
        { order: order._id },
        { status: 'SOLD' }
      );
      
      // Activate QR codes and confirm attendees
      const tickets = await Ticket.find({ order: order._id })
        .populate('attendee');
      
      for (const ticket of tickets) {
        if (ticket.attendee) {
          ticket.attendee.confirmationStatus = 'confirmed';
          ticket.attendee.isConfirmed = true;
          await ticket.attendee.save();
        }
        
        // Generate QR code if not exists
        if (!ticket.qrCode) {
          ticket.qrCode = await QRCode.toDataURL(ticket.ticketNumber);
          await ticket.save();
        }
      }
      
      // Send notifications
      try {
        // Send email notification to buyer
        await notifyBuyerTicketProgress(order.buyerEmail, {
          orderNumber: order.orderNumber,
          eventName: order.eventId?.name,
          status: 'confirmed',
        });
        
        // Send final ticket notification
        for (const ticket of tickets) {
          if (ticket.attendee) {
            await notifyFinalTicket(ticket.attendee, order.eventId);
          }
        }
        
        // Create in-app notification
        await Notification.create({
          user: order.buyerEmail,
          title: 'Payment Approved',
          message: `Your payment for order ${order.orderNumber} has been approved. Your tickets are now confirmed.`,
          type: 'success',
          metadata: {
            orderId: order._id,
            submissionId: paymentSubmission._id,
          },
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        // Continue even if notifications fail
      }
      
      // Log activity
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
      
      // Emit dashboard event
      const io = req.app.get('io');
      emitDashboardEvent(order.eventId?._id, 'payment_approved', {
        orderId: order._id,
        submissionId: paymentSubmission._id,
        amount: paymentSubmission.amountPaid,
      });
    }
    
    res.status(200).json({
      message: 'Payment approved successfully',
      data: {
        submissionId: paymentSubmission._id,
        orderNumber: order.orderNumber,
        verificationStatus: 'approved',
      },
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ message: 'Failed to approve payment', error: error.message });
  }
};

// Reject payment
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

    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ message: 'Payment submission not found.' });
    }

    if (paymentSubmission.verificationStatus === 'rejected') {
      return res.status(400).json({ message: 'Payment is already rejected.' });
    }

    // Update payment submission
    paymentSubmission.verificationStatus = 'rejected';
    paymentSubmission.verifiedBy = user._id;
    paymentSubmission.verifiedAt = new Date();
    paymentSubmission.rejectionReason = rejectionReason.trim();
    await paymentSubmission.save();
    
    // Update order status
    const order = await Order.findById(paymentSubmission.orderId._id)
      .populate('eventId');
    
    if (order) {
      order.status = 'CANCELLED';
      order.paymentStatus = 'failed';
      await order.save();
      
      // Update ticket statuses
      await Ticket.updateMany(
        { order: order._id },
        { status: 'CANCELLED' }
      );
      
      // Send notification
      try {
        await Notification.create({
          user: order.buyerEmail,
          title: 'Payment Rejected',
          message: `Your payment for order ${order.orderNumber} has been rejected. Reason: ${rejectionReason}`,
          type: 'error',
          metadata: {
            orderId: order._id,
            submissionId: paymentSubmission._id,
            rejectionReason,
          },
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }
      
      // Log activity
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
      
      // Emit dashboard event
      const io = req.app.get('io');
      emitDashboardEvent(order.eventId?._id, 'payment_rejected', {
        orderId: order._id,
        submissionId: paymentSubmission._id,
        amount: paymentSubmission.amountPaid,
        rejectionReason,
      });
    }
    
    res.status(200).json({
      message: 'Payment rejected successfully',
      data: {
        submissionId: paymentSubmission._id,
        orderNumber: order.orderNumber,
        verificationStatus: 'rejected',
        rejectionReason,
      },
    });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ message: 'Failed to reject payment', error: error.message });
  }
};

// Request more information
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

    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ message: 'Payment submission not found.' });
    }

    // Update payment submission
    paymentSubmission.verificationStatus = 'needs_info';
    paymentSubmission.notes = message.trim();
    await paymentSubmission.save();
    
    // Send notification
    const order = await Order.findById(paymentSubmission.orderId._id)
      .populate('eventId');
    
    if (order) {
      try {
        await Notification.create({
          user: order.buyerEmail,
          title: 'Payment Information Requested',
          message: `Additional information is required for your payment for order ${order.orderNumber}: ${message}`,
          type: 'info',
          metadata: {
            orderId: order._id,
            submissionId: paymentSubmission._id,
          },
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }
      
      // Log activity
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
      data: {
        submissionId: paymentSubmission._id,
        verificationStatus: 'needs_info',
      },
    });
  } catch (error) {
    console.error('Error requesting more info:', error);
    res.status(500).json({ message: 'Failed to request information', error: error.message });
  }
};

// Get bank accounts (for admin)
exports.getBankAccounts = async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find().sort({ createdAt: -1 });
    res.status(200).json({ data: bankAccounts });
  } catch (error) {
    console.error('Error getting bank accounts:', error);
    res.status(500).json({ message: 'Failed to get bank accounts', error: error.message });
  }
};

// Create bank account (for admin)
exports.createBankAccount = async (req, res) => {
  try {
    const {
      bankName,
      accountName,
      accountNumber,
      branch,
      swiftCode,
      qrCode,
    } = req.body;

    const bankAccount = new BankAccount({
      bankName,
      accountName,
      accountNumber,
      branch,
      swiftCode,
      qrCode,
      createdBy: req.user._id,
    });

    await bankAccount.save();

    res.status(201).json({
      message: 'Bank account created successfully',
      data: bankAccount,
    });
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ message: 'Failed to create bank account', error: error.message });
  }
};

// Update bank account (for admin)
exports.updateBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const updates = req.body;

    const bankAccount = await BankAccount.findByIdAndUpdate(
      accountId,
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (!bankAccount) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    res.status(200).json({
      message: 'Bank account updated successfully',
      data: bankAccount,
    });
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ message: 'Failed to update bank account', error: error.message });
  }
};

// Delete bank account (for admin)
exports.deleteBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    const bankAccount = await BankAccount.findByIdAndDelete(accountId);
    if (!bankAccount) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    res.status(200).json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ message: 'Failed to delete bank account', error: error.message });
  }
};
