const User = require('../models/user.model');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

/**
 * GET /api/v1/workers
 * Full discovery endpoint: supports skill, district, rating, experience,
 * geo (lat/lng/radius), pagination (page/limit), and text search (q).
 */
exports.getWorkers = async (req, res, next) => {
  try {
    const {
      skill, district, rating, experience, q,
      lat, lng, radius = 20,
      page = 1, limit = 12
    } = req.query;

    // Workers are identified by having skills in their workerProfile.
    // The `role` field is often not updated, so we key off skills presence.
    let query = {
      'workerProfile.skills': { $exists: true, $not: { $size: 0 } }
    };
    // -- Text search across name, skills, bio --
    if (q) {
      query.$or = [
        { 'sharedProfile.name': { $regex: q, $options: 'i' } },
        { 'workerProfile.skills': { $regex: q, $options: 'i' } },
        { 'sharedProfile.bio': { $regex: q, $options: 'i' } }
      ];
    }

    // -- Skill filter (overrides base query with more specific regex) --
    if (skill) {
      // Use $elemMatch equivalent: any element of the skills array matches
      query['workerProfile.skills'] = { $regex: skill, $options: 'i' };
      // The $not:{$size:0} base check is superceded by this — still finds only users with skills
    }

    // -- District filter --
    if (district) {
      query['sharedProfile.address.district'] = { $regex: district, $options: 'i' };
    }

    // -- Rating filter --
    if (rating) {
      query['workerProfile.stats.rating'] = { $gte: parseFloat(rating) };
    }

    // -- Experience filter (numeric years extracted) --
    if (experience) {
      const yrs = parseFloat(experience);
      if (!isNaN(yrs)) {
        // Experience stored as a string like "5 Years" – we do a safe regex match
        query['workerProfile.experience'] = { $regex: `^[${Math.floor(yrs)}-9]`, $options: 'i' };
      }
    }

    // -- Geo search: if lat/lng provided, filter by radius using $geoWithin --
    if (lat && lng) {
      query['workerProfile.location'] = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseFloat(radius) / 6378.1
          ]
        }
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);

    const workers = await User.find(query)
      .select('sharedProfile workerProfile')
      .sort({ 'workerProfile.stats.rating': -1, 'workerProfile.stats.jobsCompleted': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const formattedWorkers = workers.map(w => ({
      _id: w._id,
      name: w.sharedProfile?.name || 'Worker',
      photo: w.sharedProfile?.photo || null,
      bio: w.sharedProfile?.bio || '',
      skills: w.workerProfile?.skills || [],
      experience: w.workerProfile?.experience || 'Not specified',
      expectedWage: w.workerProfile?.expectedWage || null,
      availability: w.workerProfile?.availability || 'available',
      rating: w.workerProfile?.stats?.rating || 0,
      totalReviews: w.workerProfile?.stats?.totalReviews || 0,
      jobsCompleted: w.workerProfile?.stats?.jobsCompleted || 0,
      location: [
        w.sharedProfile?.address?.village,
        w.sharedProfile?.address?.district,
        w.sharedProfile?.address?.state
      ].filter(Boolean).join(', ') || 'Location not set'
    }));

    sendResponse(res, STATUS_CODES.SUCCESS, 'Workers fetched successfully', formattedWorkers, {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Worker Discovery Error', error);
    next(new AppError('Failed to fetch workers', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

/**
 * GET /api/v1/workers/:id
 * Returns a full worker profile including portfolio and reviews.
 */
exports.getWorkerById = async (req, res, next) => {
  try {
    const worker = await User.findOne({
      _id: req.params.id,
      'workerProfile.skills': { $exists: true, $not: { $size: 0 } }
    }).select('sharedProfile workerProfile createdAt');

    if (!worker) {
      return next(new AppError('Worker not found', STATUS_CODES.NOT_FOUND));
    }

    const profile = {
      _id: worker._id,
      name: worker.sharedProfile?.name || 'Worker',
      photo: worker.sharedProfile?.photo || null,
      bio: worker.sharedProfile?.bio || '',
      phone: worker.sharedProfile?.phone || null,
      address: worker.sharedProfile?.address || {},
      skills: worker.workerProfile?.skills || [],
      experience: worker.workerProfile?.experience || 'Not specified',
      expectedWage: worker.workerProfile?.expectedWage || null,
      availability: worker.workerProfile?.availability || null,
      portfolio: worker.workerProfile?.portfolio || [],
      stats: {
        rating: worker.workerProfile?.stats?.rating || 0,
        totalReviews: worker.workerProfile?.stats?.totalReviews || 0,
        jobsCompleted: worker.workerProfile?.stats?.jobsCompleted || 0
      },
      memberSince: worker.createdAt
    };

    sendResponse(res, STATUS_CODES.SUCCESS, 'Worker profile fetched', profile);
  } catch (error) {
    console.error('Worker Profile Error', error);
    next(new AppError('Failed to fetch worker profile', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Kept for backwards compatibility
exports.searchWorkers = exports.getWorkers;

exports.updateAvailability = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const { availability } = req.body;
    
    // Ensure we initialize object if not present
    if (!user.workerProfile) {
      user.workerProfile = {};
    }
    
    user.workerProfile.availability = availability;
    await user.save();

    sendResponse(res, STATUS_CODES.SUCCESS, 'Availability updated', { availability });
  } catch (error) {
    console.error('Update Availability Error', error);
    next(new AppError('Failed to update availability', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
