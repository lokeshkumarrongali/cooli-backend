const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const authMiddleware = require('../middleware/auth.middleware');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');

// Health Check
router.get('/health', (req, res) => {
  sendResponse(res, STATUS_CODES.SUCCESS, 'Cooli API is healthy');
});

const jobRoutes = require('./job.routes');

// Auth Routes
router.use('/auth', authRoutes);

// Profile Routes
router.use('/profile', profileRoutes);

// Job Routes
router.use('/jobs', jobRoutes);

// Review Routes
const reviewRoutes = require('./review.routes');
router.use('/reviews', reviewRoutes);

// Notification Routes
const notificationRoutes = require('./notification.routes');
router.use('/notifications', notificationRoutes);

// Upload Routes
const uploadRoutes = require('./upload.routes');
router.use('/upload', uploadRoutes);

// Worker Routes
const workerRoutes = require('./worker.routes');
router.use('/workers', workerRoutes);

// Saved Job Routes
const savedJobRoutes = require('./savedJob.routes');
router.use('/', savedJobRoutes);

// AI Feature Routes
const aiRoutes = require('./ai.routes');
router.use('/ai', aiRoutes);

// Chat/Message Routes
const messageRoutes = require('./message.routes');
router.use('/chat', messageRoutes);

// Protected Route Placeholder
router.get('/protected', authMiddleware, (req, res) => {
  sendResponse(res, STATUS_CODES.SUCCESS, 'You have accessed a protected route', { user: req.user });
});

module.exports = router;
