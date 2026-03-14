const User = require('../models/user.model');
const Job = require('../models/job.model');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

// POST /api/v1/jobs/:jobId/save
exports.saveJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const user = await User.findOne({ providerId: req.user.uid });

    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const jobExists = await Job.findById(jobId);
    if (!jobExists) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    // Check if already saved
    const isSaved = user.savedJobs.find(saved => saved.jobId.toString() === jobId);
    
    if (!isSaved) {
      user.savedJobs.push({ jobId });
      await user.save();
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Job saved successfully');
  } catch (error) {
    next(new AppError('Failed to save job', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// DELETE /api/v1/jobs/:jobId/save
exports.removeSavedJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const user = await User.findOne({ providerId: req.user.uid });

    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    user.savedJobs = user.savedJobs.filter(saved => saved.jobId.toString() !== jobId);
    await user.save();

    sendResponse(res, STATUS_CODES.SUCCESS, 'Job removed from saved');
  } catch (error) {
    next(new AppError('Failed to remove saved job', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// GET /api/v1/users/saved-jobs
exports.getSavedJobs = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid })
      .populate({
        path: 'savedJobs.jobId',
        select: 'title description wage location status requiredSkills createdAt employer'
      });

    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    // Filter out jobs that might have been deleted but are still in array
    const validSavedJobs = user.savedJobs.filter(saved => saved.jobId);
    const result = validSavedJobs.map(saved => saved.jobId);

    sendResponse(res, STATUS_CODES.SUCCESS, 'Saved jobs fetched successfully', result);
  } catch (error) {
    next(new AppError('Failed to fetch saved jobs', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
