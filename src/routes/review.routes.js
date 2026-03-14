const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

router.use(verifyFirebaseToken);

router.post('/', reviewController.createReview);
router.get('/users/:id', reviewController.getUserReviews);

module.exports = router;
