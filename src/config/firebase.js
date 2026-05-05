const admin = require("firebase-admin");
const fs = require("fs");
const { env } = require("./env");

const loadServiceAccount = () => {
  if (env.firebase.serviceAccountPath) {
    const fileContents = fs.readFileSync(env.firebase.serviceAccountPath, "utf8");
    return JSON.parse(fileContents);
  }

  if (env.firebase.serviceAccountJson) {
    try {
      return JSON.parse(env.firebase.serviceAccountJson);
    } catch (jsonError) {
      const decodedJson = Buffer.from(
        env.firebase.serviceAccountJson,
        "base64",
      ).toString("utf8");

      return JSON.parse(decodedJson);
    }
  }

  return {
    projectId: env.firebase.projectId,
    clientEmail: env.firebase.clientEmail,
    privateKey: env.firebase.privateKey,
  };
};

const initializeFirebaseApp = () => {
  if (!env.isFirebaseConfigured) {
    throw new Error(
      "Firebase Admin is not configured. Add a Firebase service account path or service account environment values first.",
    );
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount()),
    });
  }

  return admin.app();
};

const initializeFirebase = () => {
  initializeFirebaseApp();
  return admin.auth();
};

module.exports = { initializeFirebase, initializeFirebaseApp };
