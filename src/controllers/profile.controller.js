const User = require('../models/user.model');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const sharedProfile = user.sharedProfile || {};
    if (!sharedProfile.name) {
      sharedProfile.name = user.name;
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Profile fetched successfully', {
      _id: user._id,
      sharedProfile: sharedProfile,
      workerProfile: user.workerProfile || {},
      employerProfile: user.employerProfile || {}
    });
  } catch (error) {
    next(new AppError('Failed to fetch profile', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

const axios = require('axios');

exports.updateProfile = async (req, res, next) => {
  try {
    const { sharedProfile, workerProfile, employerProfile } = req.body;

    if (sharedProfile?.address) {
      const { houseNo, street, village, mandal, district, state, country, pincode } = sharedProfile.address;
      const addrParts = [village, mandal, district, state, country].filter(Boolean);
      const addressString = addrParts.join(', ');

      if (addressString) {
        try {
          // OpenStreetMap Nominatim request
          const geocodeRes = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}`, {
            headers: { 'User-Agent': 'CooliApp/1.0' }
          });
          if (geocodeRes.data && geocodeRes.data.length > 0) {
            const { lat, lon } = geocodeRes.data[0];
            sharedProfile.address.coordinates = {
              lat: parseFloat(lat),
              lng: parseFloat(lon)
            };
            if (workerProfile) {
              if(!workerProfile.location) workerProfile.location = { type: "Point" };
              workerProfile.location.coordinates = [parseFloat(lon), parseFloat(lat)];
            }
          }
        } catch (geoError) {
          console.warn("Geocoding failed:", geoError.message);
        }
      }
    }

    const updateData = {
      sharedProfile,
      workerProfile,
      employerProfile
    };
    
    if (sharedProfile?.name) {
      updateData.name = sharedProfile.name;
    }

    // Auto-set role based on which profile section is populated.
    // This ensures worker discovery queries find the right users.
    if (workerProfile?.skills?.length > 0) {
      updateData.role = 'worker';
    } else if (employerProfile?.businessName) {
      updateData.role = 'employer';
    }

    const updatedUser = await User.findOneAndUpdate(
      { providerId: req.user.uid },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Profile updated successfully', {
      _id: updatedUser._id,
      sharedProfile: updatedUser.sharedProfile,
      workerProfile: updatedUser.workerProfile,
      employerProfile: updatedUser.employerProfile
    });
  } catch (error) {
    next(new AppError('Profile update failed', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
exports.updateProfilePhoto = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return next(new AppError('Missing imageUrl', STATUS_CODES.BAD_REQUEST));
    }
    const updatedUser = await User.findOneAndUpdate(
      { providerId: req.user.uid },
      { 'sharedProfile.photo': imageUrl },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }
    sendResponse(res, STATUS_CODES.SUCCESS, 'Profile photo updated', {
      profilePhoto: updatedUser.sharedProfile.photo,
    });
  } catch (error) {
    next(new AppError('Failed to update profile photo', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

