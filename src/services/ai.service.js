const axios = require('axios');

/**
 * AI Intent Extraction using Google Gemini 1.5 Flash.
 * Converts unstructured speech text into a structured JSON for job search.
 * 
 * @param {string} text - User's voice-to-text string.
 * @returns {Promise<Object>} - Format { job_type: string, location: string, radius: number|null, skills: string[] }.
 */
exports.extractIntent = async (text) => {
  const getFallback = (rawText) => {
    const rawKeywords = typeof rawText === 'string' ? rawText.split(' ').map(w => w.trim().toLowerCase()).filter(w => w.length > 2) : [];
    return { job_roles: [], skills: [], keywords: rawKeywords };
  };
  const fallback = getFallback(text);

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.warn("AI SERVICE ERROR: GEMINI_API_KEY is not defined in environment.");
      return fallback;
    }

    const prompt = `
      You are an intelligent job search assistant.
      Step 1: Translate the following user query to English if it's in Hindi, Telugu, or mixed language.
      Step 2: Extract the job search intent and expand the keywords with synonyms.
      Query: "${text}"

      Expand keywords with common terms (e.g. coolie -> labor, helper, worker).
      
      Return STRICT JSON only:
      {
        "job_roles": [],
        "skills": [],
        "keywords": []
      }

      Rules:
      - Job roles should be generic titles (driver, helper, electrician)
      - Skills should be specific capabilities
      - Keywords must include all expanded synonyms and important terms
      - Return ONLY the JSON object
    `;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;

    const response = await axios.post(endpoint, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    // Extract content from Gemini response structure
    const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) return fallback;

    // Clean response (sometimes Gemini adds Markdown snippets)
    const jsonString = candidate.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error("AI SERVICE ERROR: JSON Parsing failed for response:", candidate);
      return fallback;
    }

  } catch (error) {
    console.error("AI SERVICE ERROR: Gemini API call failed:", error.message);
    return fallback;
  }
};

/**
 * AI Re-ranking using Google Gemini.
 * Takes the top matched jobs and re-ranks them based on relevance to the query.
 * 
 * @param {string} text - User's original voice-to-text string.
 * @param {Array} jobs - Top filtered and scored jobs (limit 5-10).
 * @returns {Promise<Array<number>>} - Array of job indices.
 */
exports.rerankJobs = async (text, jobs) => {
  // If AI fails, fallback is to keep original order (which is already score-sorted)
  const defaultRanking = jobs.map((_, i) => i);
  if (!jobs || jobs.length === 0) return defaultRanking;

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return defaultRanking;

    // Minimize job data sent to Gemini to save tokens
    const jobsContext = jobs.map((job, index) => ({
      index,
      title: job.title,
      description: job.description?.substring(0, 150), // Send snippet
      skills: job.requiredSkills
    }));

    const prompt = `
      Given the user query and job list, rank jobs based on relevance.
      User Query: "${text}"

      Jobs List:
      ${JSON.stringify(jobsContext, null, 2)}

      Return STRICT JSON with ranking indices only.
      Example:
      {
        "ranking": [2, 0, 1]
      }
    `;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    // Use a slightly faster request if token constraints are small, but 1.5-pro is fine and robust.
    const response = await axios.post(endpoint, {
      contents: [{
        parts: [{ text: prompt }]
      }]
    });

    const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) return defaultRanking;

    const jsonString = candidate.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.ranking && Array.isArray(parsed.ranking)) {
        return parsed.ranking;
      }
      return defaultRanking;
    } catch (e) {
      console.error("AI reranking parse fail:", candidate);
      return defaultRanking;
    }
  } catch (error) {
    console.error("AI reranking network fail:", error.message);
    return defaultRanking;
  }
};
