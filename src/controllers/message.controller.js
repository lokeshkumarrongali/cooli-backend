const Conversation = require("../models/conversation.model");
const Message      = require("../models/message.model");
const User         = require("../models/user.model");
const { sendResponse } = require("../utils/response");
const { STATUS_CODES } = require("../utils/constants");
const AppError = require("../utils/AppError");

// ─── Helper: get MongoDB user from Firebase UID ───────────────────────────────
const getMongoUser = async (uid) => {
  const user = await User.findOne({ providerId: uid });
  if (!user) throw new AppError("User not found", STATUS_CODES.NOT_FOUND);
  return user;
};

// ─── POST /chat/conversations ──────────────────────────────────────────────────
// Creates OR returns an existing conversation between two users (idempotent)
exports.createConversation = async (req, res, next) => {
  try {
    const me = await getMongoUser(req.user.uid);
    const { otherUserId, jobId } = req.body;

    if (!otherUserId) {
      return next(new AppError("otherUserId is required", STATUS_CODES.BAD_REQUEST));
    }
    if (otherUserId === me._id.toString()) {
      return next(new AppError("Cannot start a conversation with yourself", STATUS_CODES.BAD_REQUEST));
    }

    // Check existing conversation between these two participants
    let convo = await Conversation.findOne({
      participants: { $all: [me._id, otherUserId], $size: 2 },
    });

    if (!convo) {
      convo = await Conversation.create({
        participants: [me._id, otherUserId],
        jobId: jobId || null,
      });
    }

    // Populate for frontend
    await convo.populate("participants", "sharedProfile employerProfile workerProfile");
    await convo.populate("jobId", "title");

    sendResponse(res, STATUS_CODES.SUCCESS, "Conversation ready", convo);
  } catch (err) {
    next(err instanceof AppError ? err : new AppError("Failed to create conversation", STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// ─── GET /chat/conversations ───────────────────────────────────────────────────
// Return all conversations the logged-in user participates in
exports.getUserConversations = async (req, res, next) => {
  try {
    const me = await getMongoUser(req.user.uid);

    const conversations = await Conversation.find({ participants: me._id })
      .populate("participants", "sharedProfile employerProfile workerProfile")
      .populate("jobId", "title")
      .sort({ lastMessageAt: -1 });

    sendResponse(res, STATUS_CODES.SUCCESS, "Conversations fetched", conversations);
  } catch (err) {
    next(new AppError("Failed to fetch conversations", STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// ─── GET /chat/messages/:conversationId ───────────────────────────────────────
// Return paginated message history for a conversation
exports.getMessages = async (req, res, next) => {
  try {
    const me = await getMongoUser(req.user.uid);
    const { conversationId } = req.params;
    const page  = parseInt(req.query.page  || "1");
    const limit = parseInt(req.query.limit || "50");

    // Verify participant
    const convo = await Conversation.findOne({
      _id: conversationId,
      participants: me._id,
    });
    if (!convo) {
      return next(new AppError("Conversation not found or access denied", STATUS_CODES.NOT_FOUND));
    }

    const messages = await Message.find({ conversationId })
      .populate("senderId", "sharedProfile employerProfile")
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendResponse(res, STATUS_CODES.SUCCESS, "Messages fetched", messages);
  } catch (err) {
    next(new AppError("Failed to fetch messages", STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// ─── POST /chat/messages ──────────────────────────────────────────────────────
// Persist a message and emit it via socket
exports.sendMessage = async (req, res, next) => {
  try {
    const me = await getMongoUser(req.user.uid);
    const { conversationId, text } = req.body;

    if (!conversationId || !text?.trim()) {
      return next(new AppError("conversationId and text are required", STATUS_CODES.BAD_REQUEST));
    }

    // Verify participant
    const convo = await Conversation.findOne({
      _id: conversationId,
      participants: me._id,
    });
    if (!convo) {
      return next(new AppError("Conversation not found or access denied", STATUS_CODES.NOT_FOUND));
    }

    const message = await Message.create({
      conversationId,
      senderId: me._id,
      text: text.trim(),
    });

    // Populate sender info for socket payload
    await message.populate("senderId", "sharedProfile employerProfile");

    // Update conversation preview
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text.trim().slice(0, 100),
      lastMessageAt: new Date(),
    });

    // Emit to everyone in the room via socket
    try {
      const { getIO } = require("../socket/socket");
      getIO().to(conversationId).emit("receiveMessage", message);
    } catch {
      // socket not critical path — REST response still returns message
    }

    sendResponse(res, STATUS_CODES.CREATED, "Message sent", message);
  } catch (err) {
    next(new AppError("Failed to send message", STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// ─── PATCH /chat/messages/:conversationId/read ────────────────────────────────
// Mark all messages in a conversation as read for the current user
exports.markRead = async (req, res, next) => {
  try {
    const me = await getMongoUser(req.user.uid);
    const { conversationId } = req.params;

    // Only mark messages NOT sent by me as read
    await Message.updateMany(
      { conversationId, senderId: { $ne: me._id }, read: false },
      { $set: { read: true } }
    );

    sendResponse(res, STATUS_CODES.SUCCESS, "Messages marked as read", {});
  } catch (err) {
    next(new AppError("Failed to mark messages as read", STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// ─── GET /chat/unread-count ────────────────────────────────────────────────────
// Return total unread message count for the badge
exports.getUnreadCount = async (req, res, next) => {
  try {
    const me = await getMongoUser(req.user.uid);

    // Find all conversations user is in
    const convos = await Conversation.find({ participants: me._id }).select("_id");
    const convoIds = convos.map((c) => c._id);

    const count = await Message.countDocuments({
      conversationId: { $in: convoIds },
      senderId: { $ne: me._id },
      read: false,
    });

    sendResponse(res, STATUS_CODES.SUCCESS, "Unread count fetched", { count });
  } catch (err) {
    next(new AppError("Failed to get unread count", STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
