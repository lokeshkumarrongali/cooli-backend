const Review = require('../models/review.model');
const Job = require('../models/job.model');
const User = require('../models/user.model');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');
const notificationService = require('../services/notification.service');

// Create a review
exports.createReview = async (req, res, next) => {
  try {
    const { jobId, receiverId, rating, comment } = req.body;
    
    const reviewer = await User.findOne({ providerId: req.user.uid });
    if (!reviewer) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    if (job.status !== 'completed') {
      return next(new AppError('Job must be completed before leaving a review', STATUS_CODES.BAD_REQUEST));
    }

    // Verify reviewer participated in the job (either employer or hiredWorker)
    const isEmployer = job.employerId.toString() === reviewer._id.toString();
    const isHiredWorker = job.hiredWorker && job.hiredWorker.toString() === reviewer._id.toString();
    
    if (!isEmployer && !isHiredWorker) {
      return next(new AppError('You did not participate in this job', STATUS_CODES.FORBIDDEN));
    }

    // Prevent duplicate reviews
    const existingReview = await Review.findOne({ jobId, reviewerId: reviewer._id });
    if (existingReview) {
      return next(new AppError('You already reviewed this job', STATUS_CODES.BAD_REQUEST));
    }

    // Prevent self-review (reviewer cannot review themselves)
    if (reviewer._id.toString() === receiverId?.toString()) {
      return next(new AppError('You cannot review yourself', STATUS_CODES.BAD_REQUEST));
    }

    // Validate receiverId is provided
    if (!receiverId) {
      return next(new AppError('receiverId is required', STATUS_CODES.BAD_REQUEST));
    }

    // Create the review
    const newReview = await Review.create({
      jobId,
      reviewerId: reviewer._id,
      receiverId,
      rating,
      comment
    });

    // Recalculate rating
    const allReviews = await Review.find({ receiverId });
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0 ? (allReviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews) : rating;

    // Update receiver's profile stats
    const receiver = await User.findById(receiverId);
    if (receiver) {
      if (isEmployer) {
        // Employer reviewing worker
        if (receiver.workerProfile && receiver.workerProfile.stats) {
          receiver.workerProfile.stats.rating = averageRating;
          receiver.workerProfile.stats.totalReviews = totalReviews;
        }
      } else {
        // Worker reviewing employer
        if (receiver.employerProfile && receiver.employerProfile.stats) {
          receiver.employerProfile.stats.rating = averageRating;
          receiver.employerProfile.stats.totalReviews = totalReviews;
        }
      }
      await receiver.save();
    }

    // Notify receiver with reviewer name + job title + deep-link
    const reviewerName = reviewer.sharedProfile?.name || reviewer.name || "Someone";
    const redirectUrl = isEmployer
      ? `/worker/profile`        // worker goes to their own profile reviews tab
      : `/employer/profile`;     // employer goes to their business profile
    notificationService.sendNotification(
      receiverId,
      "review_received",
      `${reviewerName} left you a review for "${job.title}"`,
      { jobId, reviewerId: reviewer._id },
      redirectUrl
    );

    sendResponse(res, STATUS_CODES.CREATED, 'Review submitted successfully', newReview);
  } catch (error) {
    next(new AppError('Failed to submit review', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Get reviews for user
exports.getUserReviews = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const reviews = await Review.find({ receiverId: userId })
      .populate('reviewerId', 'sharedProfile name email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 });

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 ? (reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews) : 0;

    sendResponse(res, STATUS_CODES.SUCCESS, 'Reviews fetched successfully', {
      reviews,
      averageRating,
      totalReviews
    });
  } catch (error) {
    next(new AppError('Failed to fetch reviews', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
