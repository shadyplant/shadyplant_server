const { cert, getApp, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { env } = require("./env");

const loadServiceAccount = () => ({
  projectId: env.firebase.projectId,
  clientEmail: env.firebase.clientEmail,
  privateKey: env.firebase.privateKey,
});

const initializeFirebaseApp = () => {
  if (!env.isFirebaseConfigured) {
    throw new Error("Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT first.");
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(loadServiceAccount()),
    });
  }

  return getApp();
};

const initializeFirebase = () => {
  const app = initializeFirebaseApp();
  return getAuth(app);
};

module.exports = { initializeFirebase, initializeFirebaseApp };
