require('dotenv').config();
const aiService = require('./src/services/ai.service');

async function test() {
  console.log("Testing extractIntent...");
  const intent = await aiService.extractIntent("I need a cleaner job in Mumbai");
  console.log("Intent result:", intent);

  console.log("Testing rerankJobs...");
  const jobs = [
    { title: "Driver", description: "Driving car", requiredSkills: ["driving"] },
    { title: "Cleaner", description: "Cleaning house", requiredSkills: ["cleaning"] }
  ];
  const ranking = await aiService.rerankJobs("cleaner", jobs);
  console.log("Ranking result:", ranking);
}

test();
