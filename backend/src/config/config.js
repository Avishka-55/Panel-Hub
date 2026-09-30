const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

// Load .env from backend or root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Ensure MASTER_KEY exists, or generate a stable fallback warning in dev
if (!process.env.MASTER_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: MASTER_KEY environment variable is required in production mode!');
  } else {
    console.warn('[SECURITY WARNING] MASTER_KEY not set. Generating a temporary 32-byte master key for development session.');
    process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
  }
}

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/panelhub',
  jwtSecret: process.env.JWT_SECRET || 'panelhub-jwt-super-secret-key-change-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || '',
  turnstileSecretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || ''
};
