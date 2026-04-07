const express = require('express');
const { sendResponse } = require('../utils/response');
const { STATUS_CODES } = require('../utils/constants');
const AppError = require('../utils/AppError');
const aiService = require('../services/ai.service');
const { scoreJob } = require('../services/matching.service');
const Job = require('../models/job.model');
const User = require('../models/user.model');

/**
 * POST /api/v1/ai/voice-search
 * Connects AI intent extraction with the recommendation engine.
 * Fetches personalized jobs and filters them based on user request.
 */
exports.voiceSearch = async (req, res, next) => {
  try {
    const { text, lat, lng } = req.body;
    
    if (!req.user || !req.user.uid) {
      return next(new AppError('User not authenticated via token.', STATUS_CODES.UNAUTHORIZED));
    }

    const worker = await User.findOne({ providerId: req.user.uid });
    if (!worker) {
       return next(new AppError('Worker profile not found in database.', STATUS_CODES.NOT_FOUND));
    }
    
    const workerId = worker._id;

    if (!text) {
      return next(new AppError('Text input is required for voice search', STATUS_CODES.BAD_REQUEST));
    }

    // STEP 1 — EXTRACT INTENT
    const parsed = await aiService.extractIntent(text);

    // STEP 2 — FETCH ALL RELEVANT JOBS
    // Fetch up to 150 open jobs for robust semantic filtering instead of strictly 10 recommended jobs
    let allJobs = await Job.find({ status: 'open' }).limit(150).lean().populate('employerId', 'sharedProfile employerProfile');
    
    // Compute distances & base score if coordinates are available
    if (lat && lng) {
      allJobs.forEach(job => {
        if (job.location?.coordinates) {
          const [lng1, lat1] = [parseFloat(lng), parseFloat(lat)];
          const [lng2, lat2] = job.location.coordinates;
          const R = 6371e3; 
          const phi1 = lat1 * Math.PI/180;
          const phi2 = lat2 * Math.PI/180;
          const dPhi = (lat2 - lat1) * Math.PI/180;
          const dLambda = (lng2 - lng1) * Math.PI/180;
          const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          job.dist = R * c;
        } else {
          job.dist = null;
        }
        job.score = scoreJob(job, worker, [parseFloat(lng), parseFloat(lat)]);
      });
    } else {
      allJobs.forEach(job => {
        job.dist = null;
        job.score = scoreJob(job, worker, null);
      });
    }

    // STEP 3 — FILTER JOBS
    let filteredJobs = [...allJobs];
    
    // Radius Filter
    if (parsed.radius) {
      filteredJobs = filteredJobs.filter(job => job.dist !== null && job.dist <= parsed.radius * 1000);
    }
    
    // Consolidate all possible keywords
    let allKeywords = [];
    if (Array.isArray(parsed.job_roles)) allKeywords.push(...parsed.job_roles.map(r => r.toLowerCase()));
    if (Array.isArray(parsed.skills)) allKeywords.push(...parsed.skills.map(s => s.toLowerCase()));
    if (Array.isArray(parsed.keywords)) allKeywords.push(...parsed.keywords.map(k => k.toLowerCase()));
    
    // Fallback split logic if Gemini parsing was empty completely
    if (allKeywords.length === 0 && text) {
      allKeywords = text.split(' ').map(w => w.trim().toLowerCase()).filter(w => w.length > 2);
    }
    
    // Remove empty strings
    allKeywords = allKeywords.filter(k => k);

    if (allKeywords.length > 0) {
      filteredJobs = filteredJobs.reduce((acc, job) => {
        let aiScore = 0;
        const titleText = (job.title || '').toLowerCase();
        const descText = (job.description || '').toLowerCase();
        const skillsText = Array.isArray(job.requiredSkills) ? job.requiredSkills.join(" ").toLowerCase() : '';
        const locText = (job.location?.city || job.location?.address || '').toLowerCase();
        
        allKeywords.forEach(keyword => {
          if (titleText.includes(keyword)) aiScore += 3;
          if (skillsText.includes(keyword)) aiScore += 2;
          if (descText.includes(keyword)) aiScore += 1;
          if (locText.includes(keyword)) aiScore += 1;
        });
        
        if (aiScore > 0) {
          acc.push({ ...job, aiScore });
        }
        return acc;
      }, []);

      // Sort results by score descending
      filteredJobs.sort((a, b) => b.aiScore - a.aiScore);

      // STEP 3.5 — AI RE-RANKING (Top 10 jobs)
      const topJobs = filteredJobs.slice(0, 10);
      const remainingJobs = filteredJobs.slice(10);

      const aiRankingIndices = await aiService.rerankJobs(text, topJobs);
      
      const rerankedTop = [];
      if (Array.isArray(aiRankingIndices)) {
        aiRankingIndices.forEach(idx => {
          if (topJobs[idx]) rerankedTop.push(topJobs[idx]);
        });
      }
      
      // Safety construct: push any jobs that AI missed
      topJobs.forEach(job => {
        if (!rerankedTop.includes(job)) rerankedTop.push(job);
      });
      
      filteredJobs = [...rerankedTop, ...remainingJobs];
    }

    // Return filteredJobs if keywords were used and matches exist, otherwise return allJobs
    const finalJobs = filteredJobs.length > 0 ? filteredJobs : allJobs;

    sendResponse(res, STATUS_CODES.SUCCESS, 'Voice search successful', {
      status: "success",
      parsedText: parsed,
      results: finalJobs.length,
      data: {
        jobs: finalJobs
      }
    });
  } catch (error) {
    console.error('AI Voice Search Error:', error);
    next(new AppError('Failed to process voice search', STATUS_CODES.INTERNAL_SERVER_ERROR));
  }
};
