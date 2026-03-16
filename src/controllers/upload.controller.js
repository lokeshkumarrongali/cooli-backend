const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

exports.uploadMedia = async (req, res, next) => {
  try {
    console.log('Upload request received. File:', req.file ? req.file.originalname : 'No file');
    
    if (!req.file) {
      return next(new AppError('No file uploaded', STATUS_CODES.BAD_REQUEST));
    }
    
    // In some versions, it's path, in others secure_url
    const imageUrl = req.file.path || req.file.secure_url;
    console.log('Successfully uploaded to Cloudinary:', imageUrl);
    
    sendResponse(res, STATUS_CODES.SUCCESS, 'File uploaded successfully', { imageUrl });
  } catch (error) {
    console.error('CRITICAL: Cloudinary Upload Error:', error);
    next(new AppError(`File upload failed: ${error.message}`, STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
