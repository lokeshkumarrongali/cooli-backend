const { STATUS_CODES, ERROR_MESSAGES } = require('../utils/constants');
const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err,
    });
  }

  // Production Error Handling
  if (err.isOperational) {
    return sendError(res, err.statusCode, err.message);
  }

  // Programming or other unknown errors: don't leak error details
  console.error('[CRITICAL ERROR]', err);
  return sendError(res, STATUS_CODES.INTERNAL_SERVER_ERROR, ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
};

module.exports = errorHandler;
