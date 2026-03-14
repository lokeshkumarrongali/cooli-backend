const { STATUS_CODES } = require('./constants');

/**
 * Standardized API response format
 */
const sendResponse = (res, statusCode, message, data = null, pagination = null) => {
  const body = {
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
  };
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
};

/**
 * Error response format
 */
const sendError = (res, statusCode, message, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = {
  sendResponse,
  sendError,
};
