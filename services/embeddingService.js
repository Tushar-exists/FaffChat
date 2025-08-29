const { logger } = require('../utils/logger');

const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const HF_API_URL_PIPELINE = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateEmbedding(text) {
  const input = typeof text === 'string' ? text.replace(/\n/g, ' ') : '';
  if (!input) {
    logger.warn('generateEmbedding called with empty text.');
    return null;
  }

  try {
    const maxAttempts = 3;
    let attempt = 0;
    let lastError;
    while (attempt < maxAttempts) {
      try {
        if (!process.env.HF_API_TOKEN) {
          throw new Error('HF_API_TOKEN is not set');
        }

        const response = await fetch(HF_API_URL_PIPELINE, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Wait-For-Model': 'true'
          },
          body: JSON.stringify({ inputs: input })
        });

        if (!response.ok) {
          const raw = await response.text();
          let detail = raw;
          try {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.error || parsed.message)) {
              detail = parsed.error || parsed.message;
            }
          } catch (_) {}
          const err = new Error(`HF ${response.status}: ${detail}`);
          err.status = response.status;
          throw err;
        }

        let data = await response.json();
        while (Array.isArray(data) && Array.isArray(data[0])) {
          data = data[0];
        }
        const embedding = Array.isArray(data) ? data : null;
        if (!embedding) throw new Error('HF returned no embedding');
        return embedding;
      } catch (err) {
        lastError = err;
        const message = String(err?.message || err);
        const status = err?.status;
        const isRateLimited = status === 429 || message.toLowerCase().includes('rate');
        const isRetryable = isRateLimited || status === 503 || status === 502;
        if (!isRateLimited) throw err;
        const backoffMs = Math.min(2000 * Math.pow(2, attempt), 15000);
        attempt += 1;
        if (attempt >= maxAttempts) break;
        await sleep(backoffMs);
      }
    }
    throw lastError || new Error('Embedding generation failed after retries');

  } catch (error) {
    logger.error('Error generating embedding', { error: error.message });
    return null;
  }
}

module.exports = { generateEmbedding };