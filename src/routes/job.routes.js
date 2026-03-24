const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

// Public route - anyone should be able to see available jobs
router.get('/', jobController.getAllJobs);

// Protected routes - require a valid Firebase token
router.use(verifyFirebaseToken);

router.post('/', jobController.createJob);
router.get('/employer', jobController.getEmployerJobs); // Must come before /:id to prevent route shadowing
router.get('/worker-history', jobController.getWorkerJobHistory); // Must come before /:id
router.get('/nearby', jobController.getNearbyJobs);
router.get('/search', jobController.searchJobs);
router.get('/:id', jobController.getJobDetails);
router.post('/:id/apply', jobController.applyForJob);
router.get('/:id/applicants', jobController.getJobApplicants);

// Lifecycle Routes
router.post('/:id/hire', jobController.hireWorker);
router.post('/:id/reject', jobController.rejectApplicant);
router.post('/:id/complete', jobController.completeJob);

module.exports = router;

