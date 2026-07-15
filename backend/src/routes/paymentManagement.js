const express = require('express');
const router = express.Router();
const { protect, checkRole, requireEventAccess, requirePermission } = require('../middleware/auth');
const { ROLES } = require('../utils/rbac');
const {
  getPaymentSubmissions,
  getPaymentSubmissionDetails,
  approvePayment,
  rejectPayment,
  requestMoreInfo,
  getPaymentStatistics,
  exportPayments,
} = require('../controllers/paymentManagementController');

// Apply authentication middleware
router.use(protect);

// Organizer payment management routes
router.get('/organizer', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), getPaymentSubmissions);
router.get('/organizer/statistics', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), getPaymentStatistics);
router.get('/organizer/:submissionId', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), getPaymentSubmissionDetails);
router.post('/organizer/:submissionId/approve', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), requirePermission('canApprovePayments'), approvePayment);
router.post('/organizer/:submissionId/reject', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), requirePermission('canApprovePayments'), rejectPayment);
router.post('/organizer/:submissionId/request-info', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), requirePermission('canApprovePayments'), requestMoreInfo);
router.get('/organizer/export', checkRole(['main_organiser', 'sub_organiser', 'main_admin', 'super_admin']), exportPayments);

// Admin payment management routes
router.get('/admin', checkRole(['main_admin', 'super_admin']), getPaymentSubmissions);
router.get('/admin/statistics', checkRole(['main_admin', 'super_admin']), getPaymentStatistics);
router.get('/admin/:submissionId', checkRole(['main_admin', 'super_admin']), getPaymentSubmissionDetails);
router.post('/admin/:submissionId/approve', checkRole(['main_admin', 'super_admin']), approvePayment);
router.post('/admin/:submissionId/reject', checkRole(['main_admin', 'super_admin']), rejectPayment);
router.post('/admin/:submissionId/request-info', checkRole(['main_admin', 'super_admin']), requestMoreInfo);
router.get('/admin/export', checkRole(['main_admin', 'super_admin']), exportPayments);

module.exports = router;
