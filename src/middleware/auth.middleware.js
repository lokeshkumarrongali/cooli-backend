const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { STATUS_CODES } = require('../utils/constants');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError('No token provided', STATUS_CODES.UNAUTHORIZED));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    next(new AppError('Invalid or expired token', STATUS_CODES.UNAUTHORIZED));
  }
};

module.exports = authMiddleware;
