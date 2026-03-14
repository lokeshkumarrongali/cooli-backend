const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

// Get all notifications for logged-in user
exports.getNotifications = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    // Normalize field: expose both `read` (DB field) and `isRead` (frontend convention)
    const normalized = notifications.map(n => ({
      _id: n._id,
      type: n.type,
      message: n.message,
      data: n.data,
      redirectUrl: n.redirectUrl || null,
      read: n.read,
      isRead: n.read,
      createdAt: n.createdAt
    }));

    sendResponse(res, STATUS_CODES.SUCCESS, 'Notifications fetched successfully', normalized);
  } catch (error) {
    next(new AppError('Failed to fetch notifications', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Mark single notification as read
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return next(new AppError('Notification not found', STATUS_CODES.NOT_FOUND));
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Notification marked as read', notification);
  } catch (error) {
    next(new AppError('Failed to mark read', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Mark ALL notifications as read for the logged-in user
exports.markAllRead = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));

    await Notification.updateMany({ userId: user._id, read: false }, { read: true });

    sendResponse(res, STATUS_CODES.SUCCESS, 'All notifications marked as read', null);
  } catch (error) {
    next(new AppError('Failed to mark all read', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
