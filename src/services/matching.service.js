// src/services/matching.service.js
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Job = require('../models/job.model');
const { normalizeJobWage, normalizeExpectedWage } = require('../utils/wageNormalizer');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');

// Constants for scoring & limits
// Constants for scoring & limits
const MAX_DISTANCE_METERS = 500000; // 500km for wider search
const SCORE_DISTANCE_THRESHOLD = 20000; // distance beyond which score is 0
const MAX_CANDIDATES = 50; // fetch before scoring
const TOP_RESULTS = 10;

/** Helper to compute skill match ratio */
function computeSkillScore(workerSkills = [], jobSkills = []) {
  if (!Array.isArray(jobSkills) || jobSkills.length === 0) return 0;
  if (!Array.isArray(workerSkills)) return 0;
  
  const normalizedWorkerSkills = workerSkills
    .filter(s => typeof s === 'string')
    .map(s => s.toLowerCase().trim());
    
  const matched = jobSkills.filter((skill) => {
    if (typeof skill !== 'string') return false;
    return normalizedWorkerSkills.includes(skill.toLowerCase().trim());
  }).length;
  
  return matched / jobSkills.length;
}

/** Helper to calculate Haversine distance */
function calculateDistance(coords1, coords2) {
  if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) return null;
  const [lng1, lat1] = coords1;
  const [lng2, lat2] = coords2;
  const R = 6371e3; // meters
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const dPhi = (lat2 - lat1) * Math.PI/180;
  const dLambda = (lng2 - lng1) * Math.PI/180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/** Helper to score a single job against a worker */
function scoreJob(job, worker, referenceCoords = null) {
  if (!worker) return 0;
  
  const workerSkills = worker.workerProfile?.skills || [];
  const expectedWage = normalizeExpectedWage(worker);
  const jobWage = normalizeJobWage(job);
  
  const skillScore = computeSkillScore(workerSkills, job.requiredSkills);
  
  // Distance score logic
  let dist = typeof job.dist === 'number' ? job.dist : (typeof job.distance === 'number' ? job.distance : null);
  
  // If dist is missing but we have coordinates, calculate it
  if (dist === null && referenceCoords && job.location?.coordinates) {
    dist = calculateDistance(referenceCoords, job.location.coordinates);
  }

  let distanceScore = 0.5; // neutral
  if (dist !== null) {
    distanceScore = Math.max(0, 1 - dist / SCORE_DISTANCE_THRESHOLD);
  }

  let wageScore = 0.5; // Neutral
  if (expectedWage && jobWage) {
    wageScore = jobWage.min >= expectedWage.min ? 1 : 0.5;
  }
  
  const finalScore = skillScore * 0.5 + distanceScore * 0.3 + wageScore * 0.2;
  return Number(finalScore.toFixed(4));
}

/** Main service function */
async function getRecommendedJobs(workerId, lat = null, lng = null) {
  if (!mongoose.Types.ObjectId.isValid(workerId)) {
    throw new AppError('Invalid worker ID', STATUS_CODES.BAD_REQUEST);
  }

  const worker = await User.findById(workerId).lean();
  if (!worker) {
    throw new AppError('Worker not found', STATUS_CODES.NOT_FOUND);
  }

  // Determine reference location (passed lat/long or stored profile location)
  let referenceCoords = (lat !== null && lng !== null) 
    ? [parseFloat(lng), parseFloat(lat)] 
    : (worker.workerProfile?.location?.coordinates || null);
    
  const hasValidReference = referenceCoords && referenceCoords.length === 2;

  let jobs = [];
  if (hasValidReference) {
    try {
      jobs = await Job.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: referenceCoords },
            distanceField: 'dist',
            spherical: true,
            maxDistance: MAX_DISTANCE_METERS,
            query: { status: 'open' },
            limit: MAX_CANDIDATES,
          },
        },
        {
          $project: {
            title: 1, description: 1, requiredSkills: 1,
            wage: 1, location: 1, dist: 1, employerId: 1, createdAt: 1,
          },
        },
      ]);
    } catch (error) {
      console.warn("GeoNear failed, using fallback manual calculation:", error.message);
      let fallbackJobs = await Job.find({ status: 'open' }).limit(MAX_CANDIDATES).lean();
      jobs = fallbackJobs.map(job => ({ 
        ...job, 
        dist: calculateDistance(referenceCoords, job.location?.coordinates) || MAX_DISTANCE_METERS 
      }));
    }
  } else {
    let fallbackJobs = await Job.find({ status: 'open' }).limit(MAX_CANDIDATES).lean();
    jobs = fallbackJobs.map(job => ({ ...job, dist: null }));
  }

  const scoredJobs = jobs.map((job) => {
    const skillScore = computeSkillScore(worker.workerProfile?.skills || [], job.requiredSkills);
    return { 
      ...job, 
      score: scoreJob(job, worker, referenceCoords),
      skillMatch: skillScore
    };
  });

  scoredJobs.sort((a, b) => b.score - a.score);
  return scoredJobs.slice(0, TOP_RESULTS);
}

module.exports = {
  getRecommendedJobs,
  scoreJob,
  computeSkillScore,
};
