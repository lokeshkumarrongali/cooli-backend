const authService = require('../services/auth.service');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');

/**
 * Controller for user login and sync with Firebase
 * This is called after the verifyFirebaseToken middleware successfully
 * validates the ID token and attaches the decoded user to req.user.
 */
exports.login = async (req, res, next) => {
  try {
    const firebaseUser = req.user;

    const user = await authService.syncUserWithFirebase(firebaseUser);

    return sendResponse(res, STATUS_CODES.SUCCESS, 'Authentication successful', { user });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for logging out
 * Since we are essentially stateless with JWT/Firebase, this mainly 
 * serves as a hook if we want to perform server-side cleanup.
 */
exports.logout = (req, res, next) => {
  try {
    return sendResponse(res, STATUS_CODES.SUCCESS, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};
