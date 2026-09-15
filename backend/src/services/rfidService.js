const RfidTag = require('../models/RfidTag');
const Attendee = require('../models/Attendee');

const normalizeRfidTag = (value) => String(value || '').trim();
const isValidRfidTag = (value) => /^\d{10}$/.test(normalizeRfidTag(value));

/**
 * Allocate RFID from inventory for an attendee.
 * Per ENTRYNEX spec: RFID is NOT auto-assigned during ticket creation.
 * This function returns null to indicate no automatic allocation.
 * RFID must be manually assigned via the QR-first assignment flow.
 * 
 * @param {Object} params - Allocation parameters
 * @param {string} params.eventId - Event ID
 * @param {string} params.categoryId - Ticket category ID
 * @param {string} params.attendeeId - Attendee ID
 * @param {string} params.ticketId - Ticket ID
 * @returns {Promise<null>} - Always returns null (no auto-allocation)
 */
const allocateRfid = async ({ eventId, categoryId, attendeeId, ticketId }) => {
  // Per spec: RFID must NOT be automatically allocated during ticket creation.
  // RFID assignment happens during operational QR → RFID process.
  return null;
};

/**
 * Link a reserved/pre-assigned RFID to an attendee.
 * This function is also stubbed as RFID is not pre-reserved.
 * 
 * @param {Object} params - Link parameters
 * @param {string} params.ticketId - Ticket ID
 * @param {string} params.attendeeId - Attendee ID
 * @returns {Promise<null>} - Always returns null
 */
const linkReservedRfidToAttendee = async ({ ticketId, attendeeId }) => {
  return null;
};

/**
 * Unassign/Release an RFID tag from an attendee.
 * Sets the RFID tag status back to AVAILABLE in the inventory.
 * 
 * @param {Object} params - Unassignment parameters
 * @param {string} params.rfidTag - The RFID tag to release
 * @param {string} params.operatorId - User performing the unassignment
 * @param {string} [params.reason] - Reason for unassignment
 * @returns {Promise<Object>} - Result with released tag and updated attendee
 */
const unassignRfidFromAttendee = async ({ rfidTag, operatorId, reason }) => {
  const normalizedTag = normalizeRfidTag(rfidTag);
  if (!isValidRfidTag(normalizedTag)) {
    const error = new Error('RFID tag must be exactly 10 digits.');
    error.statusCode = 400;
    throw error;
  }

  // Find the RFID tag record
  const tag = await RfidTag.findOne({ rfidTag: normalizedTag });
  if (!tag) {
    const error = new Error('RFID tag not found in inventory.');
    error.statusCode = 404;
    throw error;
  }

  if (tag.status !== 'ASSIGNED') {
    const error = new Error('RFID tag is not currently assigned.');
    error.statusCode = 400;
    throw error;
  }

  // Find the attendee
  const attendee = await Attendee.findById(tag.attendee);
  if (!attendee) {
    const error = new Error('Assigned attendee not found.');
    error.statusCode = 404;
    throw error;
  }

  // Verify the attendee's rfidTag matches
  if (attendee.rfidTag !== normalizedTag) {
    const error = new Error('RFID tag assignment mismatch.');
    error.statusCode = 409;
    throw error;
  }

  // Remove RFID from attendee
  attendee.rfidTag = undefined;
  await attendee.save();

  // Reset RFID tag to AVAILABLE
  tag.status = 'AVAILABLE';
  tag.attendee = undefined;
  tag.ticket = undefined;
  tag.assignedAt = undefined;
  tag.assignedBy = operatorId;
  tag.event = undefined;
  tag.categoryId = undefined;
  await tag.save();

  return { attendee, tag, reason };
};

const assignRfidToAttendee = async ({ rfidTag, attendeeId, ticketId, operatorId }) => {
  const normalizedTag = normalizeRfidTag(rfidTag);
  if (!isValidRfidTag(normalizedTag)) {
    const error = new Error('RFID tag must be exactly 10 digits.');
    error.statusCode = 400;
    throw error;
  }

  const attendee = await Attendee.findById(attendeeId).populate('event').populate('ticket');
  if (!attendee) {
    const error = new Error('Attendee could not be found.');
    error.statusCode = 404;
    throw error;
  }
  if (!attendee.event?.settings?.rfidEnabled) {
    const error = new Error('RFID access is disabled for this event.');
    error.statusCode = 403;
    throw error;
  }
  if (ticketId && String(attendee.ticket?._id || attendee.ticket) !== String(ticketId)) {
    const error = new Error('RFID assignment must use the attendee ticket.');
    error.statusCode = 400;
    throw error;
  }
  if (attendee.rfidTag) {
    const error = new Error('This attendee already has an RFID tag assigned.');
    error.statusCode = 409;
    throw error;
  }

  const tag = await RfidTag.findOneAndUpdate(
    { rfidTag: normalizedTag, status: 'AVAILABLE' },
    {
      $set: {
        status: 'ASSIGNED',
        event: attendee.event._id,
        categoryId: attendee.categoryId,
        attendee: attendee._id,
        ticket: attendee.ticket?._id || attendee.ticket,
        assignedAt: new Date(),
        assignedBy: operatorId,
      },
    },
    { new: true }
  );
  if (!tag) {
    const registered = await RfidTag.findOne({ rfidTag: normalizedTag }).lean();
    const error = new Error(registered ? 'RFID tag is not available.' : 'RFID tag is not registered in the inventory.');
    error.statusCode = 409;
    throw error;
  }

  attendee.rfidTag = normalizedTag;
  await attendee.save();
  return { attendee, tag };
};

module.exports = {
  allocateRfid,
  linkReservedRfidToAttendee,
  assignRfidToAttendee,
  unassignRfidFromAttendee,
  normalizeRfidTag,
  isValidRfidTag,
};