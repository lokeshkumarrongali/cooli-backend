const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

/**
 * Route: POST /voice-search
 * Path as mounted: /api/v1/ai/voice-search
 */
router.post('/voice-search', verifyFirebaseToken, aiController.voiceSearch);

module.exports = router;
