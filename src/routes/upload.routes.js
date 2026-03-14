const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const upload = require('../middleware/upload.middleware');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

router.use(verifyFirebaseToken);

// Assuming single file upload via 'file' field
router.post('/', upload.single('file'), uploadController.uploadMedia);

module.exports = router;
