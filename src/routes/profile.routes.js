const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/profile.controller');
const verifyFirebaseToken = require('../middleware/firebaseAuth.middleware');

router.use(verifyFirebaseToken);

router.get('/', getProfile);
router.put('/', updateProfile);

router.patch('/photo', require('../controllers/profile.controller').updateProfilePhoto);
