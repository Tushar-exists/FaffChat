require('dotenv').config();

const pool = require('../config/database');
const { generateEmbedding } = require('../services/embeddingService');
const { logger } = require('../utils/logger');

const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '100', 10);
const SLEEP_MS = parseInt(process.env.BACKFILL_SLEEP_MS || '100', 10);

function toPgVector(arr) {
  if (!arr || !Array.isArray(arr)) return null;
  return `[${arr.join(',')}]`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countPending() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS pending FROM messages WHERE embedding IS NULL');
  return rows[0].pending;
}

async function fetchBatch(limit) {
  const { rows } = await pool.query(
    `SELECT id, message FROM messages WHERE embedding IS NULL ORDER BY id ASC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function updateEmbedding(id, embedding) {
  await pool.query('UPDATE messages SET embedding = $1, updated_at = NOW() WHERE id = $2', [toPgVector(embedding), id]);
}

async function backfillOnce() {
  const batch = await fetchBatch(BATCH_SIZE);
  if (batch.length === 0) return 0;

  // Generate embeddings sequentially to avoid rate limits; can be parallelized if needed
  for (const row of batch) {
    try {
      const embedding = await generateEmbedding(row.message);
      if (embedding && Array.isArray(embedding)) {
        await updateEmbedding(row.id, embedding);
        logger.info(`Backfilled embedding for message ${row.id}`);
      } else {
        logger.warn(`Embedding generation returned null/invalid for message ${row.id}; skipping.`);
      }
    } catch (error) {
      logger.error(`Failed to backfill message ${row.id}`, { error: error.message });
    }

    if (SLEEP_MS > 0) {
      await sleep(SLEEP_MS);
    }
  }

  return batch.length;
}

async function main() {
  try {
    const start = Date.now();
    let totalProcessed = 0;
    let pending = await countPending();
    logger.info(`Starting backfill. Pending messages without embeddings: ${pending}`);

    while (pending > 0) {
      const processed = await backfillOnce();
      totalProcessed += processed;
      pending = await countPending();
      logger.info(`Progress: processed=${totalProcessed}, remaining=${pending}`);
      if (processed === 0) break;
    }

    const ms = Date.now() - start;
    logger.info(`Backfill complete. Total processed=${totalProcessed} in ${ms}ms`);
  } catch (error) {
    logger.error('Backfill failed', { error: error.message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();


