const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

router.use(verifyFirebaseToken);

router.get('/', notificationController.getNotifications);
router.put('/:id/read', notificationController.markAsRead);      // backwards compat
router.patch('/:id/read', notificationController.markAsRead);    // used by frontend
router.patch('/read-all', notificationController.markAllRead);   // mark all read

module.exports = router;
