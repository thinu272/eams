const express = require('express');
const { protect } = require('../middleware/auth');
const { getAttendeeTickets, getAttendeeTicket } = require('../controllers/attendeeController');

const router = express.Router();

router.use(protect);

router.get('/tickets', getAttendeeTickets);
router.get('/ticket/:ticketId', getAttendeeTicket);

module.exports = router;
