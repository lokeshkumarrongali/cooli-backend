/* src/utils/wageNormalizer.js */
/**
 * Normalizes a job's wage field to a consistent { min, max } object.
 * Supports legacy Number, new object shape, or missing values.
 * @param {Object} job - Job document (Mongoose doc or plain object)
 * @returns {{min:number, max:number}|null}
 */
function normalizeJobWage(job) {
  if (!job) return null;
  const wage = job.wage;
  // New object shape
  if (wage && typeof wage === 'object' && wage.min != null) {
    return { min: wage.min, max: wage.max };
  }
  // Legacy primitive number
  if (typeof wage === 'number') {
    return { min: wage, max: wage };
  }
  // No wage info
  return null;
}

/**
 * Normalizes a worker's expectedWage field to { min, max }.
 * Handles legacy string/number as well as the new object shape.
 * @param {Object} user - User document (Mongoose doc or plain object)
 * @returns {{min:number, max:number}|null}
 */
function normalizeExpectedWage(user) {
  if (!user || !user.workerProfile) return null;
  const exp = user.workerProfile.expectedWage;
  // New object shape
  if (exp && typeof exp === 'object' && exp.min != null) {
    return { min: exp.min, max: exp.max };
  }
  // Legacy string or number – coerce to number
  if (typeof exp === 'string' || typeof exp === 'number') {
    const num = Number(exp);
    if (!Number.isNaN(num)) {
      return { min: num, max: num };
    }
  }
  return null;
}

module.exports = {
  normalizeJobWage,
  normalizeExpectedWage,
};
