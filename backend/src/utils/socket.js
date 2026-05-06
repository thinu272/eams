const emitDashboardEvent = (io, channel, eventId, payload) => {
  if (!io) return;

  // Global broadcast
  io.emit(channel, payload);

  if (eventId) {
    // Admin/Staff room
    io.to(`dashboard:${eventId}`).emit(channel, payload);
    
    // Public room
    io.to(`event:${eventId}`).emit(channel, payload);
  }
};

module.exports = { emitDashboardEvent };
