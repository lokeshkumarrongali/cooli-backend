const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cooli_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf'],
    resource_type: 'auto'
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;
