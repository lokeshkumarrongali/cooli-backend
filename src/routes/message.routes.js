const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

router.use(verifyFirebaseToken);

// Create or get a conversation
router.post('/conversations', messageController.createConversation);

// Get list of conversations for current user
router.get('/conversations', messageController.getUserConversations);

// Get messages in a conversation
router.get('/messages/:conversationId', messageController.getMessages);

// Send a net new message
router.post('/messages', messageController.sendMessage);

// Mark read
router.patch('/messages/:conversationId/read', messageController.markRead);

// Global unread count
router.get('/unread-count', messageController.getUnreadCount);

module.exports = router;
