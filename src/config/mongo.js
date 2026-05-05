const mongoose = require("mongoose");
const { env } = require("./env");

let connectPromise;

const initializeMongo = async () => {
  if (!connectPromise) {
    connectPromise = mongoose.connect(env.mongo.uri, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  await connectPromise;
  return mongoose.connection;
};

const closeMongo = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  connectPromise = undefined;
};

module.exports = {
  closeMongo,
  initializeMongo,
};
