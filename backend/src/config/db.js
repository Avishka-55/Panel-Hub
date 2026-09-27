const mongoose = require('mongoose');
const config = require('./config');

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return;
  }

  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[Database Error] MongoDB connection failure: ${error.message}`);
    if (error.message.includes('ECONNREFUSED')) {
      console.error(`[Database Hint] MongoDB is not running at ${config.mongoUri}.`);
      console.error(`                Run 'npm run db:start' or 'docker start mongodb' to start it.`);
    }
    throw error;
  }
}

async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('[Database] MongoDB disconnected');
}

module.exports = {
  connectDB,
  disconnectDB
};
