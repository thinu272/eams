const express = require('express');
const { protect } = require('../middleware/auth');
const { upload, handleS3Upload } = require('../middleware/s3Upload');
const {
  getBuyerOrders,
  getBuyerOrderDetails,
  assignSelfToTicket,
  inviteForTicket,
  getBuyerTickets,
  assignAttendeeToTicket,
  getBuyerInvites,
  resendInviteForTicket,
} = require('../controllers/buyerController');

const router = express.Router();

router.use(protect);

router.get('/orders', getBuyerOrders);
router.get('/orders/:orderId', getBuyerOrderDetails);
router.get('/tickets', getBuyerTickets);
router.get('/invites', getBuyerInvites);
router.post('/assign', assignAttendeeToTicket);
router.post('/tickets/:ticketId/assign-self', upload.single('photo'), handleS3Upload('attendee-photos'), assignSelfToTicket);
router.post('/tickets/:ticketId/invite', inviteForTicket);
router.post('/tickets/:ticketId/resend-invite', resendInviteForTicket);

module.exports = router;
