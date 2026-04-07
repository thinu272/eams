const express = require('express');
const Event = require('../models/Event');
const Order = require('../models/Order');
const RequestLog = require('../models/RequestLog');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

const parseDateRange = (from, to) => {
  const createdAt = {};

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) createdAt.$gte = fromDate;
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      createdAt.$lte = toDate;
    }
  }

  return Object.keys(createdAt).length ? { createdAt } : {};
};

router.use(protect, restrictTo('main_admin'));

router.get('/overview', async (req, res, next) => {
  try {
    const [totalEvents, totalUsers, revenueRows, eventStatusBreakdown, organiserAssignments, recentErrors, apiUsageSummary, apiCallsToday] = await Promise.all([
      Event.countDocuments(),
      User.countDocuments(),
      Order.aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
      Event.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Event.find({})
        .select('name status startDate mainOrganiser createdAt')
        .populate('mainOrganiser', 'name email')
        .sort({ startDate: 1 })
        .limit(12),
      RequestLog.find({ statusCode: { $gte: 400 } })
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .limit(12),
      RequestLog.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: { method: '$method', path: '$path' },
            count: { $sum: 1 },
            avgDurationMs: { $avg: '$durationMs' },
            errorCount: {
              $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            method: '$_id.method',
            path: '$_id.path',
            count: 1,
            avgDurationMs: { $round: ['$avgDurationMs', 1] },
            errorCount: 1,
          },
        },
      ]),
      RequestLog.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        globalStats: {
          totalEvents,
          totalUsers,
          totalRevenue: revenueRows[0]?.totalRevenue || 0,
          apiCallsToday,
        },
        eventStatusBreakdown,
        organiserAssignments,
        recentErrors,
        apiUsageSummary,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { type = 'all', from, to, statusCode, path, page = 1, limit = 25 } = req.query;
    const safeLimit = Math.min(parseInt(limit, 10) || 25, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;

    const filter = {
      ...parseDateRange(from, to),
    };

    if (type === 'errors') {
      filter.statusCode = { $gte: 400 };
    }
    if (statusCode) {
      filter.statusCode = parseInt(statusCode, 10);
    }
    if (path) {
      filter.path = { $regex: path, $options: 'i' };
    }

    const [logs, total] = await Promise.all([
      RequestLog.find(filter)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      RequestLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: Math.floor(skip / safeLimit) + 1,
        pages: Math.ceil(total / safeLimit),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
