const User = require('../models/user.model');
const { PROVIDERS, ROLES } = require('../utils/constants');

/**
 * Synchronize Firebase user with MongoDB using atomic upsert
 */
exports.syncUserWithFirebase = async (firebaseUser) => {
  const { name, email, uid, firebase } = firebaseUser;
  const signInProvider = firebase ? firebase.sign_in_provider : null;

  // Determine provider
  let provider = PROVIDERS.LOCAL;
  if (signInProvider === 'google.com') {
    provider = PROVIDERS.GOOGLE;
  } else if (signInProvider === 'password') {
    provider = PROVIDERS.LOCAL;
  }

  // Atomic upsert
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name: name || email.split('@')[0],
        provider,
        providerId: uid,
        isVerified: true,
        lastLogin: new Date(),
      },
      $setOnInsert: {
        role: ROLES.USER,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );

  // Sanitize user object
  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;
  delete sanitizedUser.refreshToken;

  return sanitizedUser;
};

exports.hashPassword = async (password) => {
  // Logic for hashing password
};

exports.comparePassword = async (password, hashedPassword) => {
  // Logic for password comparison
};

exports.generateToken = (user) => {
  // Logic for generating JWT
};
