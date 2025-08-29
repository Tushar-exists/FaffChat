const pool = require('../config/database');
const { generateEmbedding } = require('../services/embeddingService');
const { logger } = require('../utils/logger');

const toPgVector = (arr) => {
  if (!arr || !Array.isArray(arr)) {
    return null;
  }
  return `[${arr.join(',')}]`;
};

class Message {
  static async create({ sender_id, receiver_id, message }) {
    let embedding;
    try {
      embedding = await generateEmbedding(message);
    } catch (error) {
      logger.error('Failed to generate embedding for a new message. Storing message with null embedding.', { 
        originalMessage: message,
        error: error.message 
      });
      embedding = null;
    }

    const query = `
      INSERT INTO messages (sender_id, receiver_id, message, embedding)
      VALUES ($1, $2, $3, $4)
      RETURNING id, sender_id, receiver_id, message, created_at
    `;
    
    const result = await pool.query(query, [sender_id, receiver_id, message, toPgVector(embedding)]);
    return result.rows[0];
  }

  static async getConversation(userId1, userId2, limit = 50) {
    const query = `
      SELECT 
        m.id, m.sender_id, m.receiver_id, m.message, m.created_at, s.name as sender_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
         OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
      LIMIT $3
    `;
    
    const result = await pool.query(query, [userId1, userId2, limit]);
    return result.rows;
  }

  static async semanticSearch(userId, searchQuery, limit = 10) {
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(searchQuery);
    } catch (error) {
        logger.error('Failed to generate embedding for search query.', { query: searchQuery, error: error.message });
        return [];
    }
    if (!queryEmbedding) {
      return [];
    }
    
    const query = `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.created_at,
        s.name as sender_name,
        r.name as receiver_name,
        1 - (m.embedding <=> $1) as similarity_score
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE (m.sender_id = $2 OR m.receiver_id = $2)
        AND m.embedding IS NOT NULL
      ORDER BY m.embedding <=> $1
      LIMIT $3
    `;
    
    const result = await pool.query(query, [toPgVector(queryEmbedding), userId, limit]);
    return result.rows;
  }
}

module.exports = Message;