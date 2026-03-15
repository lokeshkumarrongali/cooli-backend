const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

/**
 * @route POST /api/v1/auth/login
 * @desc Sync Firebase user with backend database
 * @access Private (Requires valid Firebase ID Token)
 */
router.post('/login', verifyFirebaseToken, authController.login);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout user
 * @access Public
 */
router.post('/logout', authController.logout);

module.exports = router;

