const express = require('express');
const router = express.Router();
const workerController = require('../controllers/worker.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

router.use(verifyFirebaseToken);

router.get('/', workerController.getWorkers);            // GET /api/v1/workers
router.patch('/availability', workerController.updateAvailability);
router.get('/search', workerController.searchWorkers);   // backwards compat
router.get('/:id', workerController.getWorkerById);      // GET /api/v1/workers/:id

module.exports = router;
