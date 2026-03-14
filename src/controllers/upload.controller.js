const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

exports.uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', STATUS_CODES.BAD_REQUEST));
    }
    
    // Return full local URL for the frontend
    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    
    sendResponse(res, STATUS_CODES.SUCCESS, 'File uploaded successfully', { imageUrl });
  } catch (error) {
    next(new AppError('File upload failed', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
