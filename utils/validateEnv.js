const { logger } = require('./logger');

function validateAndNormalizeEnv() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'dev-insecure-secret-change-me';
    logger.warn('JWT_SECRET not set. Using an insecure development default. Set JWT_SECRET in .env.');
  }

  if (!process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    logger.info('FRONTEND_URL not set. Defaulting to http://localhost:3000');
  }

  if (!process.env.DATABASE_URL) {
    logger.warn('DATABASE_URL is not set. API endpoints that require the DB will fail until this is configured.');
  }

  return {
    jwtSecret: process.env.JWT_SECRET,
    frontendUrl: process.env.FRONTEND_URL,
    databaseUrl: process.env.DATABASE_URL
  };
}

module.exports = { validateAndNormalizeEnv };


