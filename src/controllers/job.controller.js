const Job = require('../models/job.model');
const User = require('../models/user.model');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');
const notificationService = require('../services/notification.service');

// Create a new job
exports.createJob = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const newJob = await Job.create({
      ...req.body,
      employerId: user._id
    });

    // Notify nearby workers
    if (newJob.location && newJob.location.coordinates) {
      const [lng, lat] = newJob.location.coordinates;
      const radius = 20; // km
      const nearbyWorkers = await User.find({
        role: "worker",
        "workerProfile.location": {
          $geoWithin: {
            $centerSphere: [ [lng, lat], radius / 6378.1 ]
          }
        }
      });
      const employerName = user.sharedProfile?.name || user.name || "An employer";
      for (const worker of nearbyWorkers) {
        notificationService.sendNotification(
          worker._id,
          "job_posted",
          `New job near you: "${newJob.title}" — ${employerName}`,
          { jobId: newJob._id, title: newJob.title },
          `/worker/jobs`
        );
      }
    }

    sendResponse(res, STATUS_CODES.CREATED, 'Job created successfully', newJob);
  } catch (error) {
    next(new AppError('Failed to create job', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Get all open jobs
exports.getAllJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ status: 'open' })
      .populate('employerId', 'sharedProfile employerProfile')
      .sort({ createdAt: -1 });
    
    sendResponse(res, STATUS_CODES.SUCCESS, 'Jobs fetched successfully', jobs);
  } catch (error) {
    next(new AppError('Failed to fetch jobs', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Get jobs by employer
exports.getEmployerJobs = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const jobs = await Job.find({ employerId: user._id })
      .populate('hiredWorker', '_id sharedProfile')
      .sort({ createdAt: -1 });
    sendResponse(res, STATUS_CODES.SUCCESS, 'Employer jobs fetched successfully', jobs);
  } catch (error) {
    next(new AppError('Failed to fetch employer jobs', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Get job details
exports.getJobDetails = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('employerId', 'sharedProfile employerProfile')
      .populate('applicants.workerId', 'sharedProfile workerProfile');

    if (!job) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Job details fetched successfully', job);
  } catch (error) {
    next(new AppError('Failed to fetch job details', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Apply for a job
exports.applyForJob = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    // Check if worker already applied
    const hasApplied = job.applicants.some(
      applicant => applicant.workerId.toString() === user._id.toString()
    );

    if (hasApplied) {
      return next(new AppError('You have already applied for this job', STATUS_CODES.BAD_REQUEST));
    }

    job.applicants.push({ workerId: user._id });
    await job.save();

    // Notify Employer with worker name and job title
    const workerName = user.sharedProfile?.name || user.name || "A worker";
    notificationService.sendNotification(
      job.employerId,
      "job_applied",
      `${workerName} applied to "${job.title}"`,
      { jobId: job._id, workerId: user._id },
      `/employer/jobs/${job._id}/applicants`
    );

    sendResponse(res, STATUS_CODES.SUCCESS, 'Successfully applied for job', job);
  } catch (error) {
    console.error("Apply Job Error", error);
    next(new AppError('Failed to apply for job', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Get job applicants
exports.getJobApplicants = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('applicants.workerId', 'sharedProfile workerProfile name email');

    if (!job) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Job applicants fetched successfully', job.applicants);
  } catch (error) {
    next(new AppError('Failed to fetch job applicants', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Hire a worker for a job
exports.hireWorker = async (req, res, next) => {
  try {
    const { workerId } = req.body;
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    // Verify employer owns the job
    if (job.employerId.toString() !== user._id.toString()) {
      return next(new AppError('You do not have permission to hire for this job', STATUS_CODES.FORBIDDEN));
    }

    // Ensure job is open
    if (job.status !== 'open') {
      return next(new AppError('Job is no longer open for hiring', STATUS_CODES.BAD_REQUEST));
    }

    job.hiredWorker = workerId;
    job.status = 'in-progress';
    
    // Update applicant status
    job.applicants.forEach(a => {
      if (a.workerId.toString() === workerId) {
        a.status = 'hired';
      }
    });

    await job.save();

    // Auto-update availability to busy
    const hiredWorkerDoc = await User.findById(workerId);
    if (hiredWorkerDoc && hiredWorkerDoc.workerProfile) {
      hiredWorkerDoc.workerProfile.availability = 'busy';
      await hiredWorkerDoc.save();
    }

    // Notify Worker with job title
    notificationService.sendNotification(
      workerId,
      "worker_hired",
      `You were hired for "${job.title}"`,
      { jobId: job._id, title: job.title },
      `/worker/jobs`
    );

    sendResponse(res, STATUS_CODES.SUCCESS, 'Worker hired successfully', job);
  } catch (error) {
    next(new AppError('Failed to hire worker', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Reject an applicant
exports.rejectApplicant = async (req, res, next) => {
  try {
    const { workerId } = req.body;
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    if (job.employerId.toString() !== user._id.toString()) {
      return next(new AppError('You do not have permission to modify this job', STATUS_CODES.FORBIDDEN));
    }

    let applicantUpdated = false;
    job.applicants.forEach(a => {
      if (a.workerId.toString() === workerId) {
        a.status = 'rejected';
        applicantUpdated = true;
      }
    });

    if (!applicantUpdated) {
      return next(new AppError('Applicant not found', STATUS_CODES.NOT_FOUND));
    }

    await job.save();

    // Notify Worker
    notificationService.sendNotification(
      workerId,
      "job_rejected",
      `Your application was not selected for "${job.title}"`,
      { jobId: job._id, title: job.title },
      `/worker/jobs`
    );

    sendResponse(res, STATUS_CODES.SUCCESS, 'Applicant rejected successfully', job);
  } catch (error) {
    next(new AppError('Failed to reject applicant', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Complete a job
exports.completeJob = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return next(new AppError('Job not found', STATUS_CODES.NOT_FOUND));
    }

    // Verify employer owns the job
    if (job.employerId.toString() !== user._id.toString()) {
      return next(new AppError('You do not have permission to complete this job', STATUS_CODES.FORBIDDEN));
    }

    if (job.status !== 'in-progress') {
      return next(new AppError('Only in-progress jobs can be completed', STATUS_CODES.BAD_REQUEST));
    }

    job.status = 'completed';
    await job.save();

    // Increment stats for worker and employer
    if (job.hiredWorker) {
      const worker = await User.findById(job.hiredWorker);
      if (worker && worker.workerProfile && worker.workerProfile.stats) {
        worker.workerProfile.stats.jobsCompleted += 1;
        worker.workerProfile.availability = 'available'; // Auto-update back to available
        await worker.save();
      }
      if (user.employerProfile && user.employerProfile.stats) {
        user.employerProfile.stats.workersHired += 1;
        await user.save();
      }

      // Notify worker
      notificationService.sendNotification(
        job.hiredWorker,
        "job_completed",
        `Great work! "${job.title}" has been marked complete`,
        { jobId: job._id },
        `/worker/jobs`
      );
      // Notify employer
      notificationService.sendNotification(
        job.employerId,
        "job_completed",
        `"${job.title}" has been completed successfully`,
        { jobId: job._id },
        `/employer/jobs/${job._id}/applicants`
      );
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Job marked as completed', job);
  } catch (error) {
    next(new AppError('Failed to complete job', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Get nearby jobs
exports.getNearbyJobs = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return next(new AppError('Latitude and longitude are required', STATUS_CODES.BAD_REQUEST));
    }

    const jobs = await Job.find({
      status: "open",
      location: {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseFloat(radius) / 6378.1
          ]
        }
      }
    }).populate('employerId', 'sharedProfile employerProfile');

    // Opt: Save worker location natively so they can receive future push alerts
    if (req.user) {
      const user = await User.findOne({ providerId: req.user.uid });
      if (user) {
        user.workerProfile.location = {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)]
        };
        await user.save();
      }
    }

    sendResponse(res, STATUS_CODES.SUCCESS, 'Nearby jobs fetched successfully', jobs);
  } catch (error) {
    console.error("Geospatial Query Error", error);
    next(new AppError('Failed to fetch nearby jobs', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Get completed jobs for the logged-in worker (Work History)
exports.getWorkerJobHistory = async (req, res, next) => {
  try {
    const user = await User.findOne({ providerId: req.user.uid });
    if (!user) {
      return next(new AppError('User not found', STATUS_CODES.NOT_FOUND));
    }

    const jobs = await Job.find({ hiredWorker: user._id, status: 'completed' })
      .populate('employerId', 'sharedProfile employerProfile')
      .sort({ createdAt: -1 });

    sendResponse(res, STATUS_CODES.SUCCESS, 'Work history fetched successfully', jobs);
  } catch (error) {
    console.error('Work History Error', error);
    next(new AppError('Failed to fetch work history', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

// Search Jobs
exports.searchJobs = async (req, res, next) => {
  try {
    const { q, lat, lng, radius = 50, jobType } = req.query;

    let query = { status: "open" };

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { requiredSkills: { $regex: q, $options: 'i' } }
      ];
    }

    if (jobType && jobType !== 'all') {
      query.jobType = jobType;
    }

    if (lat && lng) {
      query.location = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            parseFloat(radius) / 6378.1
          ]
        }
      };
    }

    const jobs = await Job.find(query)
      .populate('employerId', 'sharedProfile employerProfile')
      .sort({ createdAt: -1 })
      .limit(50);

    sendResponse(res, STATUS_CODES.SUCCESS, 'Jobs searched successfully', jobs);
  } catch (error) {
    console.error("Search Query Error", error);
    next(new AppError('Failed to search jobs', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};

const matchingService = require('../services/matching.service');

// Get recommended jobs for a worker
exports.getRecommendedJobs = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const jobs = await matchingService.getRecommendedJobs(workerId);

    sendResponse(res, STATUS_CODES.SUCCESS, 'Recommended jobs fetched successfully', {
      jobs
    });
  } catch (error) {
    console.error("Recommended Jobs Error", error);
    next(error);
  }
};
