const admin = require('../config/firebase');
const AppError = require('../utils/AppError');
const { STATUS_CODES } = require('../utils/constants');

/**
 * Middleware to verify Firebase ID tokens
 */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Firebase middleware - Authorization header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Missing or malformed Authorization header');
      throw new AppError('No token provided or invalid format', STATUS_CODES.UNAUTHORIZED);
    }
    const idToken = authHeader.split('Bearer ')[1];
    console.log('Extracted idToken length:', idToken ? idToken.length : 'none');

    if (!idToken) {
      throw new AppError('Token missing from header', STATUS_CODES.UNAUTHORIZED);
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error('Firebase token verification failed:', error.message);
      throw new AppError(`Invalid or expired token: ${error.message}`, STATUS_CODES.UNAUTHORIZED);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = verifyFirebaseToken;
