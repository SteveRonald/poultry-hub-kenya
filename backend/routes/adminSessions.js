import express from 'express';
import pool from '../db.js';
const router = express.Router();

// GET all admin sessions (example)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admin_sessions');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router; 