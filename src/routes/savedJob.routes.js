const express = require('express');
const router = express.Router();
const savedJobController = require('../controllers/savedJob.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

router.use(verifyFirebaseToken);

router.post('/jobs/:jobId/save', savedJobController.saveJob);
router.delete('/jobs/:jobId/save', savedJobController.removeSavedJob);
router.get('/users/saved-jobs', savedJobController.getSavedJobs);

module.exports = router;
