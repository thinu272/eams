const mongoose = require('mongoose');
const PaymentSubmission = require('../models/PaymentSubmission');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const Notification = require('../models/Notification');
const { logActivity } = require('../utils/logger');
const { notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
const { emitDashboardEvent } = require('../utils/socket');

/**
 * Get payment submissions with filtering and pagination
 */
const getPaymentSubmissions = async (req, res, next) => {
  try {
    const {
      status = 'pending',
      eventId,
      page = 1,
      limit = 20,
      search = '',
      dateFrom,
      dateTo,
      bank,
      amountMin,
      amountMax
    } = req.query;

    const user = req.user;
    const role = user.role?.toLowerCase();
    
    // Build base filter
    const filter = {};
    
    // Status filter
    if (status && status !== 'all') {
      filter.verificationStatus = status;
    }
    
    // Bank filter
    if (bank) {
      filter.bankUsed = { $regex: bank, $options: 'i' };
    }
    
    // Amount range filter
    if (amountMin || amountMax) {
      filter.amountPaid = {};
      if (amountMin) filter.amountPaid.$gte = parseFloat(amountMin);
      if (amountMax) filter.amountPaid.$lte = parseFloat(amountMax);
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.submittedAt = {};
      if (dateFrom) filter.submittedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.submittedAt.$lte = new Date(dateTo);
    }
    
    // Search filter (search by payer name, email, reference number)
    if (search) {
      filter.$or = [
        { payerName: { $regex: search, $options: 'i' } },
        { payerEmail: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Event scoping based on user role
    let accessibleOrderIds = [];
    
    if (role === 'main_admin' || role === 'super_admin') {
      // Admin can see all payments
      if (eventId) {
        const ordersForEvent = await Order.find({ 
          eventId: mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId,
          paymentMethod: 'bank_transfer'
        }).select('_id');
        accessibleOrderIds = ordersForEvent.map(o => o._id);
      } else {
        // Get all bank transfer orders
        const allBankTransferOrders = await Order.find({ paymentMethod: 'bank_transfer' }).select('_id');
        accessibleOrderIds = allBankTransferOrders.map(o => o._id);
      }
    } else {
      // Organisers only see payments for their assigned events
      const assignedEventIds = (user.assignedEvents || []).map(id => 
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );
      
      if (assignedEventIds.length === 0) {
        return res.json({ 
          success: true, 
          data: { 
            payments: [], 
            total: 0, 
            pages: 0 
          } 
        });
      }
      
      const targetEventId = eventId || assignedEventIds[0];
      
      // Check if user has access to the requested event
      if (eventId && !assignedEventIds.some(id => id.toString() === eventId.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have access to this event.' 
        });
      }
      
      const ordersForEvents = await Order.find({ 
        eventId: { $in: assignedEventIds },
        paymentMethod: 'bank_transfer'
      }).select('_id');
      accessibleOrderIds = ordersForEvents.map(o => o._id);
    }
    
    if (accessibleOrderIds.length > 0) {
      filter.orderId = { $in: accessibleOrderIds };
    } else {
      return res.json({ 
        success: true, 
        data: { 
          payments: [], 
          total: 0, 
          pages: 0 
        } 
      });
    }
    
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const [payments, total] = await Promise.all([
      PaymentSubmission.find(filter)
        .populate('orderId', 'orderNumber totalAmount buyerEmail buyerName eventId')
        .populate('verifiedBy', 'name email role')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      PaymentSubmission.countDocuments(filter)
    ]);
    
    // Get event details for each payment
    const eventIds = payments
      .map(p => p.orderId?.eventId)
      .filter(id => id);
    
    const events = await Event.find({ _id: { $in: eventIds } })
      .select('name startDate endDate venue')
      .lean();
    
    const eventMap = new Map(events.map(e => [e._id.toString(), e]));
    
    // Get ticket details for each order
    const orderIds = payments.map(p => p.orderId?._id).filter(id => id);
    const tickets = await Ticket.find({ order: { $in: orderIds } })
      .select('order categoryName price status')
      .lean();
    
    const ticketsByOrder = new Map();
    tickets.forEach(ticket => {
      const orderKey = ticket.order.toString();
      if (!ticketsByOrder.has(orderKey)) {
        ticketsByOrder.set(orderKey, []);
      }
      ticketsByOrder.get(orderKey).push(ticket);
    });
    
    const enrichedPayments = payments.map(payment => {
      const event = payment.orderId?.eventId ? eventMap.get(payment.orderId.eventId.toString()) : null;
      const orderTickets = payment.orderId?._id ? ticketsByOrder.get(payment.orderId._id.toString()) || [] : [];
      
      // Calculate ticket summary
      const ticketSummary = orderTickets.reduce((acc, ticket) => {
        if (!acc[ticket.categoryName]) {
          acc[ticket.categoryName] = { count: 0, total: 0 };
        }
        acc[ticket.categoryName].count += 1;
        acc[ticket.categoryName].total += ticket.price || 0;
        return acc;
      }, {});
      
      return {
        _id: payment._id,
        orderId: payment.orderId?._id,
        orderNumber: payment.orderId?.orderNumber,
        event: event ? {
          _id: event._id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          venue: event.venue,
        } : null,
        buyer: payment.orderId ? {
          name: payment.orderId.buyerName,
          email: payment.orderId.buyerEmail,
        } : null,
        ticketSummary: Object.entries(ticketSummary).map(([name, data]) => ({
          categoryName: name,
          quantity: data.count,
          amount: data.total,
        })),
        totalAmount: payment.orderId?.totalAmount || payment.amountPaid,
        paymentMethod: 'bank_transfer',
        bankUsed: payment.bankUsed,
        referenceNumber: payment.referenceNumber,
        amountPaid: payment.amountPaid,
        submittedAt: payment.submittedAt,
        verificationStatus: payment.verificationStatus,
        verifiedAt: payment.verifiedAt,
        verifiedBy: payment.verifiedBy ? {
          _id: payment.verifiedBy._id,
          name: payment.verifiedBy.name,
          email: payment.verifiedBy.email,
          role: payment.verifiedBy.role,
        } : null,
        rejectionReason: payment.rejectionReason,
      };
    });
    
    res.json({ 
      success: true, 
      data: { 
        payments: enrichedPayments,
        total, 
        pages: Math.ceil(total / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
      } 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get detailed payment submission information
 */
const getPaymentSubmissionDetails = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
    }
    
    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId')
      .populate('verifiedBy', 'name email role');
    
    if (!paymentSubmission) {
      return res.status(404).json({ success: false, message: 'Payment submission not found.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (role !== 'main_admin' && role !== 'super_admin') {
      if (!assignedEventIds.includes(paymentSubmission.orderId?.eventId?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have access to this payment.' 
        });
      }
    }
    
    // Get order details
    const order = await Order.findById(paymentSubmission.orderId._id)
      .populate('eventId', 'name startDate endDate venue settings categories');
    
    // Get tickets for this order
    const tickets = await Ticket.find({ order: paymentSubmission.orderId._id })
      .populate('attendee', 'fullName email phone confirmationStatus')
      .lean();
    
    // Get event details
    const event = order?.eventId;
    
    res.json({
      success: true,
      data: {
        paymentSubmission: {
          _id: paymentSubmission._id,
          payerName: paymentSubmission.payerName,
          payerEmail: paymentSubmission.payerEmail,
          payerPhone: paymentSubmission.payerPhone,
          payerNicPassport: paymentSubmission.payerNicPassport,
          bankUsed: paymentSubmission.bankUsed,
          transferDate: paymentSubmission.transferDate,
          transferTime: paymentSubmission.transferTime,
          referenceNumber: paymentSubmission.referenceNumber,
          amountPaid: paymentSubmission.amountPaid,
          receiptFile: paymentSubmission.receiptFile,
          receiptFileType: paymentSubmission.receiptFileType,
          notes: paymentSubmission.notes,
          verificationStatus: paymentSubmission.verificationStatus,
          rejectionReason: paymentSubmission.rejectionReason,
          submittedAt: paymentSubmission.submittedAt,
          verifiedAt: paymentSubmission.verifiedAt,
          verifiedBy: paymentSubmission.verifiedBy ? {
            _id: paymentSubmission.verifiedBy._id,
            name: paymentSubmission.verifiedBy.name,
            email: paymentSubmission.verifiedBy.email,
            role: paymentSubmission.verifiedBy.role,
          } : null,
        },
        order: order ? {
          _id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          createdAt: order.createdAt,
        } : null,
        event: event ? {
          _id: event._id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          venue: event.venue,
          settings: event.settings,
        } : null,
        tickets: tickets.map(ticket => ({
          _id: ticket._id,
          ticketNumber: ticket.ticketNumber,
          categoryName: ticket.categoryName,
          price: ticket.price,
          status: ticket.status,
          attendee: ticket.attendee ? {
            fullName: ticket.attendee.fullName,
            email: ticket.attendee.email,
            phone: ticket.attendee.phone,
            confirmationStatus: ticket.attendee.confirmationStatus,
          } : null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve a payment submission
 */
const approvePayment = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { notes } = req.body;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
    }
    
    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ success: false, message: 'Payment submission not found.' });
    }
    
    if (paymentSubmission.verificationStatus === 'approved') {
      return res.status(400).json({ success: false, message: 'Payment is already approved.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (role !== 'main_admin' && role !== 'super_admin') {
      if (!assignedEventIds.includes(paymentSubmission.orderId?.eventId?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to approve this payment.' 
        });
      }
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
          const QRCode = require('qrcode');
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
    
    res.json({ 
      success: true, 
      message: 'Payment approved successfully.',
      data: {
        paymentSubmission: {
          _id: paymentSubmission._id,
          verificationStatus: paymentSubmission.verificationStatus,
          verifiedAt: paymentSubmission.verifiedAt,
          verifiedBy: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject a payment submission
 */
const rejectPayment = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { rejectionReason } = req.body;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
    }
    
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }
    
    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ success: false, message: 'Payment submission not found.' });
    }
    
    if (paymentSubmission.verificationStatus === 'rejected') {
      return res.status(400).json({ success: false, message: 'Payment is already rejected.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (role !== 'main_admin' && role !== 'super_admin') {
      if (!assignedEventIds.includes(paymentSubmission.orderId?.eventId?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to reject this payment.' 
        });
      }
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
    
    res.json({ 
      success: true, 
      message: 'Payment rejected successfully.',
      data: {
        paymentSubmission: {
          _id: paymentSubmission._id,
          verificationStatus: paymentSubmission.verificationStatus,
          verifiedAt: paymentSubmission.verifiedAt,
          verifiedBy: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
          rejectionReason: paymentSubmission.rejectionReason,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Request more information for a payment submission
 */
const requestMoreInfo = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { message } = req.body;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
    }
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    
    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ success: false, message: 'Payment submission not found.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (role !== 'main_admin' && role !== 'super_admin') {
      if (!assignedEventIds.includes(paymentSubmission.orderId?.eventId?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to request information for this payment.' 
        });
      }
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
    
    res.json({ 
      success: true, 
      message: 'Information request sent successfully.',
      data: {
        paymentSubmission: {
          _id: paymentSubmission._id,
          verificationStatus: paymentSubmission.verificationStatus,
          notes: paymentSubmission.notes,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get payment statistics for dashboard
 */
const getPaymentStatistics = async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const user = req.user;
    const role = user.role?.toLowerCase();
    
    // Build filter based on user permissions
    let orderIds = [];
    
    if (role === 'main_admin' || role === 'super_admin') {
      if (eventId) {
        const ordersForEvent = await Order.find({ 
          eventId: mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId,
          paymentMethod: 'bank_transfer'
        }).select('_id');
        orderIds = ordersForEvent.map(o => o._id);
      } else {
        const allBankTransferOrders = await Order.find({ paymentMethod: 'bank_transfer' }).select('_id');
        orderIds = allBankTransferOrders.map(o => o._id);
      }
    } else {
      const assignedEventIds = (user.assignedEvents || []).map(id => 
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );
      
      const targetEventId = eventId || assignedEventIds[0];
      
      if (eventId && !assignedEventIds.some(id => id.toString() === eventId.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have access to this event.' 
        });
      }
      
      const ordersForEvents = await Order.find({ 
        eventId: { $in: assignedEventIds },
        paymentMethod: 'bank_transfer'
      }).select('_id');
      orderIds = ordersForEvents.map(o => o._id);
    }
    
    const filter = orderIds.length > 0 ? { orderId: { $in: orderIds } } : {};
    
    const [
      totalPayments,
      pendingPayments,
      approvedPayments,
      rejectedPayments,
      needsInfoPayments,
      totalAmount,
      approvedAmount,
      pendingAmount
    ] = await Promise.all([
      PaymentSubmission.countDocuments(filter),
      PaymentSubmission.countDocuments({ ...filter, verificationStatus: 'pending' }),
      PaymentSubmission.countDocuments({ ...filter, verificationStatus: 'approved' }),
      PaymentSubmission.countDocuments({ ...filter, verificationStatus: 'rejected' }),
      PaymentSubmission.countDocuments({ ...filter, verificationStatus: 'needs_info' }),
      PaymentSubmission.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      PaymentSubmission.aggregate([
        { $match: { ...filter, verificationStatus: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      PaymentSubmission.aggregate([
        { $match: { ...filter, verificationStatus: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
    ]);
    
    // Get recent activity
    const recentPayments = await PaymentSubmission.find(filter)
      .populate('orderId', 'orderNumber buyerEmail buyerName')
      .populate('verifiedBy', 'name')
      .sort({ submittedAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalPayments,
          pendingPayments,
          approvedPayments,
          rejectedPayments,
          needsInfoPayments,
          totalAmount: totalAmount[0]?.total || 0,
          approvedAmount: approvedAmount[0]?.total || 0,
          pendingAmount: pendingAmount[0]?.total || 0,
        },
        recentPayments: recentPayments.map(payment => ({
          _id: payment._id,
          orderNumber: payment.orderId?.orderNumber,
          buyerName: payment.orderId?.browserName,
          buyerEmail: payment.orderId?.buyerEmail,
          amountPaid: payment.amountPaid,
          verificationStatus: payment.verificationStatus,
          submittedAt: payment.submittedAt,
          verifiedAt: payment.verifiedAt,
          verifiedBy: payment.verifiedBy?.name,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export payment data
 */
const exportPayments = async (req, res, next) => {
  try {
    const XLSX = require('xlsx');
    const { status, eventId, format = 'xlsx' } = req.query;
    const user = req.user;
    const role = user.role?.toLowerCase();
    
    // Build filter
    const filter = {};
    if (status && status !== 'all') {
      filter.verificationStatus = status;
    }
    
    // Event scoping
    let orderIds = [];
    
    if (role === 'main_admin' || role === 'super_admin') {
      if (eventId) {
        const ordersForEvent = await Order.find({ 
          eventId: mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId,
          paymentMethod: 'bank_transfer'
        }).select('_id');
        orderIds = ordersForEvent.map(o => o._id);
      } else {
        const allBankTransferOrders = await Order.find({ paymentMethod: 'bank_transfer' }).select('_id');
        orderIds = allBankTransferOrders.map(o => o._id);
      }
    } else {
      const assignedEventIds = (user.assignedEvents || []).map(id => 
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );
      
      const ordersForEvents = await Order.find({ 
        eventId: { $in: assignedEventIds },
        paymentMethod: 'bank_transfer'
      }).select('_id');
      orderIds = ordersForEvents.map(o => o._id);
    }
    
    if (orderIds.length > 0) {
      filter.orderId = { $in: orderIds };
    }
    
    const payments = await PaymentSubmission.find(filter)
      .populate('orderId', 'orderNumber buyerEmail buyerName eventId')
      .populate('verifiedBy', 'name email')
      .sort({ submittedAt: -1 })
      .lean();
    
    // Get event details
    const eventIds = payments.map(p => p.orderId?.eventId).filter(id => id);
    const events = await Event.find({ _id: { $in: eventIds } })
      .select('name')
      .lean();
    
    const eventMap = new Map(events.map(e => [e._id.toString(), e.name]));
    
    // Prepare data for export
    const headers = [
      'Order Number',
      'Event',
      'Buyer Name',
      'Buyer Email',
      'Payer Name',
      'Payer Email',
      'Payer Phone',
      'Bank Used',
      'Transfer Date',
      'Transfer Time',
      'Reference Number',
      'Amount Paid',
      'Verification Status',
      'Submitted At',
      'Verified At',
      'Verified By',
      'Rejection Reason',
      'Notes',
    ];
    
    const data = payments.map(payment => {
      const eventName = payment.orderId?.eventId ? eventMap.get(payment.orderId.eventId.toString()) : 'Unknown';
      return [
        payment.orderId?.orderNumber || '',
        eventName,
        payment.orderId?.buyerName || '',
        payment.orderId?.buyerEmail || '',
        payment.payerName,
        payment.payerEmail,
        payment.payerPhone,
        payment.bankUsed,
        payment.transferDate ? new Date(payment.transferDate).toISOString().split('T')[0] : '',
        payment.transferTime,
        payment.referenceNumber,
        payment.amountPaid,
        payment.verificationStatus,
        payment.submittedAt ? new Date(payment.submittedAt).toISOString() : '',
        payment.verifiedAt ? new Date(payment.verifiedAt).toISOString() : '',
        payment.verifiedBy?.name || '',
        payment.rejectionReason || '',
        payment.notes || '',
      ];
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    
    const isExcel = format === 'xlsx';
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: isExcel ? 'xlsx' : 'csv' });
    const ext = isExcel ? 'xlsx' : 'csv';
    const mime = isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
    
    res.setHeader('Content-Disposition', `attachment; filename="payments-export-${Date.now()}.${ext}"`);
    res.setHeader('Content-Type', mime);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPaymentSubmissions,
  getPaymentSubmissionDetails,
  approvePayment,
  rejectPayment,
  requestMoreInfo,
  getPaymentStatistics,
  exportPayments,
};
