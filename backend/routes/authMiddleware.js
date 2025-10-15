import jwt from 'jsonwebtoken';
import pool from '../db.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

export async function authenticateAdminSession(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const [sessions] = await pool.query(
      'SELECT * FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()',
      [token]
    );
    if (sessions.length === 0) {
      return res.status(403).json({ error: 'Invalid or expired admin session' });
    }
    req.admin = sessions[0];
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to authenticate admin session', details: err.message });
  }
} 