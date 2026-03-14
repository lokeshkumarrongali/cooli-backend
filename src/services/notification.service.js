const Notification = require('../models/notification.model');
const socketConfig = require('../socket/socket');

/**
 * Send a notification and persist it to MongoDB.
 * @param {ObjectId} userId     - Recipient user's _id
 * @param {string}   type       - Notification type enum
 * @param {string}   message    - Human-readable message (already personalised by caller)
 * @param {Object}   data       - Metadata (jobId, workerId, etc.)
 * @param {string}   redirectUrl - Deep-link URL the frontend should navigate to on click
 */
exports.sendNotification = async (userId, type, message, data = {}, redirectUrl = null) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      message,
      data,
      redirectUrl
    });

    // Emit in real-time if the user is connected via Socket.IO
    const io = socketConfig.getIO();
    const users = socketConfig.getUsers();
    const socketId = users.get(userId.toString());

    if (socketId) {
      io.to(socketId).emit("notification", {
        _id: notification._id,
        type: notification.type,
        message: notification.message,
        data: notification.data,
        redirectUrl: notification.redirectUrl,
        read: false,
        isRead: false,
        createdAt: notification.createdAt
      });
    }

    return notification;
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
};
