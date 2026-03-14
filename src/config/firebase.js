const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccount.json");

// Robust handling of the private key newline characters
if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
  // Replace literal '\n' (the two-character sequence) with a real newline
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  
  // Also ensure no other weird escaped characters from copy-pasting
  // If it's already a real newline, this won't hurt.
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("Firebase Admin SDK initialization failed:", error.message);
  }
}

module.exports = admin;
