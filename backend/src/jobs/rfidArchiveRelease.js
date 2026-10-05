/**
 * RFID Archive & Release Scheduled Job
 * =====================================
 * Identifies completed events past their archival threshold (e.g., 24 hours after endDate),
 * marks them as 'archived', and automatically releases any active RFID assignments back
 * to the available inventory.
 *
 * Design rules:
 *  - Historical assignments are NEVER deleted; status is set to RELEASED.
 *  - Physical tags in RfidTag are reset to AVAILABLE so they can be reused.
 *  - Safe and idempotent: can run repeatedly without corrupting data.
 */

const Event = require('../models/Event');
const RfidTag = require('../models/RfidTag');
const RfidAssignment = require('../models/RfidAssignment');

const ARCHIVE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

const runArchiveAndRelease = async () => {
  try {
    const thresholdDate = new Date(Date.now() - ARCHIVE_GRACE_PERIOD_MS);

    // Find completed/ended events past the grace period that are not yet marked archived
    const eventsToArchive = await Event.find({
      status: { $in: ['completed', 'published', 'ongoing'] },
      endDate: { $lt: thresholdDate },
    });

    if (!eventsToArchive.length) {
      return { processedEvents: 0, releasedAssignments: 0 };
    }

    let totalReleased = 0;

    for (const event of eventsToArchive) {
      // Find all active assignments for this event
      const activeAssignments = await RfidAssignment.find({
        event: event._id,
        status: 'ACTIVE',
      });

      if (activeAssignments.length > 0) {
        const tagIds = activeAssignments.map((a) => a.rfidTagId).filter(Boolean);

        // 1. Mark assignments as RELEASED
        await RfidAssignment.updateMany(
          { event: event._id, status: 'ACTIVE' },
          {
            $set: {
              status: 'RELEASED',
              releasedAt: new Date(),
              releaseReason: 'Automatic event archive release',
            },
          }
        );

        // 2. Mark physical inventory tags as AVAILABLE
        if (tagIds.length) {
          await RfidTag.updateMany(
            { _id: { $in: tagIds }, status: 'ASSIGNED' },
            {
              $set: {
                status: 'AVAILABLE',
                event: null,
                attendee: null,
                ticket: null,
                categoryId: null,
                assignedAt: null,
              },
            }
          );
        }

        totalReleased += activeAssignments.length;
      }

      // Mark the event as archived if status was completed
      if (event.status === 'completed') {
        event.status = 'archived';
        await event.save();
      }
    }

    if (totalReleased > 0) {
      console.log(`[RFID Archive Job] Successfully released ${totalReleased} tags across ${eventsToArchive.length} archived events.`);
    }

    return { processedEvents: eventsToArchive.length, releasedAssignments: totalReleased };
  } catch (error) {
    console.error('[RFID Archive Job] Error during archive & release:', error);
    return { error: error.message };
  }
};

const startRfidArchiveJob = (intervalMs = 60 * 60 * 1000) => {
  // Run once after server starts (with a short 10-second delay)
  setTimeout(() => {
    runArchiveAndRelease();
  }, 10000);

  // Then run periodically (default every 1 hour)
  setInterval(() => {
    runArchiveAndRelease();
  }, intervalMs);

  console.log('[RFID Archive Job] Scheduled periodic release job initialized.');
};

module.exports = {
  runArchiveAndRelease,
  startRfidArchiveJob,
};
