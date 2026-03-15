const admin = require("firebase-admin");

console.log("Project ID:", process.env.FIREBASE_PROJECT_ID);
console.log("Client Email:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("Private Key Exists:", !!process.env.FIREBASE_PRIVATE_KEY);

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1') 
    : undefined,
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  throw new Error("Missing Firebase environment variables");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK initialized successfully.");
}

module.exports = admin;
