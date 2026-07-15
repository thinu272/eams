const express = require('express');
const router = express.Router();
const bankTransferController = require('../controllers/bankTransferController');
const { protect: authenticate } = require('../middleware/auth');
const { upload } = require('../controllers/bankTransferController');

// Public routes
router.post('/order', bankTransferController.createBankTransferOrder);
router.get('/instructions/:orderId', bankTransferController.getBankTransferInstructions);
router.post('/submit/:orderId', upload.single('receipt'), bankTransferController.submitPaymentReceipt);

// Protected routes (require authentication)
router.get('/payments', authenticate, bankTransferController.getPendingPayments);
router.post('/payments/:submissionId/approve', authenticate, bankTransferController.approvePayment);
router.post('/payments/:submissionId/reject', authenticate, bankTransferController.rejectPayment);
router.post('/payments/:submissionId/request-info', authenticate, bankTransferController.requestMoreInfo);

// Admin routes
router.get('/bank-accounts', authenticate, bankTransferController.getBankAccounts);
router.post('/bank-accounts', authenticate, bankTransferController.createBankAccount);
router.put('/bank-accounts/:accountId', authenticate, bankTransferController.updateBankAccount);
router.delete('/bank-accounts/:accountId', authenticate, bankTransferController.deleteBankAccount);

module.exports = router;
