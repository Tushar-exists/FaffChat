const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(name, email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
    `;
    
    const result = await db.query(query, [name, email, passwordHash]);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async getAllUsers() {
    const query = 'SELECT id, name, email, created_at FROM users ORDER BY name';
    const result = await db.query(query);
    return result.rows;
  }

  static async verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
  }
}

module.exports = User;

