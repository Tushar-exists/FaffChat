const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

async function initDatabase(pool) {
  try {
    const sqlPath = path.join(__dirname, '..', 'init.sql');
    if (!fs.existsSync(sqlPath)) {
      logger.warn('init.sql not found, skipping DB initialization');
      return;
    }

    const rawSql = fs.readFileSync(sqlPath, 'utf8');

    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    } catch (extErr) {
      logger.warn(`Skipping CREATE EXTENSION due to error: ${(extErr && extErr.message) || extErr}`);
    }

    const filteredSql = rawSql
      .split(/\r?\n/)
      .filter(line => !/CREATE\s+EXTENSION/i.test(line))
      .join('\n');
    
    await pool.query(filteredSql);

    logger.info('✅ Database initialized successfully');
  } catch (error) {
    logger.error('❌ Database initialization failed', { error: error.message });
    throw error;
  }
}

module.exports = { initDatabase };