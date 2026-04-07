const emitDashboardEvent = (io, channel, eventId, payload) => {
  if (!io) return;

  io.emit(channel, payload);

  if (eventId) {
    io.to(`dashboard:${eventId}`).emit(channel, payload);
  }
};

module.exports = { emitDashboardEvent };
