// src/services/matching.service.js
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Job = require('../models/job.model');
const { normalizeJobWage, normalizeExpectedWage } = require('../utils/wageNormalizer');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

// Constants for scoring & limits
const MAX_DISTANCE_METERS = 20000; // 20km
const MAX_CANDIDATES = 50; // fetch before scoring
const TOP_RESULTS = 10;

/** Helper to compute skill match ratio */
function computeSkillScore(workerSkills = [], jobSkills = []) {
  if (!Array.isArray(jobSkills) || jobSkills.length === 0) return 0;
  const normalizedWorkerSkills = workerSkills.map(s => s.toLowerCase().trim());
  const matched = jobSkills.filter((skill) => normalizedWorkerSkills.includes(skill.toLowerCase().trim())).length;
  return matched / jobSkills.length;
}

/** Main service function */
async function getRecommendedJobs(workerId) {
  if (!mongoose.Types.ObjectId.isValid(workerId)) {
    throw new AppError('Invalid worker ID', STATUS_CODES.BAD_REQUEST);
  }

  // 1. Fetch worker (lean for performance)
  const worker = await User.findById(workerId).lean();
  if (!worker) {
    throw new AppError('Worker not found', STATUS_CODES.NOT_FOUND);
  }

  // 2. Extract location and expected wage
  const location = worker.workerProfile?.location;
  if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    throw new AppError('Worker location is missing or invalid', STATUS_CODES.BAD_REQUEST);
  }

  const expectedWage = normalizeExpectedWage(worker);
  const workerSkills = worker.workerProfile?.skills || [];

  // 3. GeoNear aggregation for nearby open jobs
  let jobs = [];
  try {
    jobs = await Job.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: location.coordinates },
          distanceField: 'dist',
          spherical: true,
          maxDistance: MAX_DISTANCE_METERS,
          query: { status: 'open' },
          limit: MAX_CANDIDATES,
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          requiredSkills: 1,
          wage: 1,
          location: 1,
          dist: 1,
          employerId: 1,
          createdAt: 1,
        },
      },
    ]);
  } catch (error) {
    throw new AppError('Failed to fetch job recommendations', STATUS_CODES.INTERNAL_SERVER_ERROR);
  }

  // 4. Score each job
  const scoredJobs = jobs.map((job) => {
    const jobWage = normalizeJobWage(job);
    const skillScore = computeSkillScore(workerSkills, job.requiredSkills);
    const distanceScore = Math.max(0, 1 - job.dist / MAX_DISTANCE_METERS); // 0‑1
    let wageScore = 0.5; // Neutral score if either missing
    if (expectedWage && jobWage) {
      wageScore = jobWage.min >= expectedWage.min ? 1 : 0.5;
    }
    const finalScore = skillScore * 0.5 + distanceScore * 0.3 + wageScore * 0.2;
    return { ...job, score: Number(finalScore.toFixed(4)) };
  });

  // 5. Sort and limit to top 10
  scoredJobs.sort((a, b) => b.score - a.score);
  return scoredJobs.slice(0, TOP_RESULTS);
}

module.exports = {
  getRecommendedJobs,
};
