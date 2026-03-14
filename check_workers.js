const User = require('./src/models/user.model');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cooli').then(async () => {
  const count = await User.countDocuments({'workerProfile.skills': {$exists:true, $not:{$size:0}}});
  const roleCount = await User.countDocuments({role:'worker'});
  console.log('Users with skills (discoverable):', count);
  console.log('Users with role=worker:', roleCount);
  process.exit();
});
