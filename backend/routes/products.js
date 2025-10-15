import express from 'express';
import pool from '../db.js';
const router = express.Router();

// GET all products with optional filters
router.get('/', async (req, res) => {
  const { search, category, location } = req.query;
  let sql = `SELECT p.*, v.farm_name, v.location FROM products p JOIN vendors v ON p.vendor_id = v.id WHERE 1=1`;
  const params = [];
  if (search) {
    sql += ' AND (p.name LIKE ? OR v.farm_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category && category !== 'all') {
    sql += ' AND p.category = ?';
    params.push(category);
  }
  if (location && location !== 'all') {
    sql += ' AND v.location = ?';
    params.push(location);
  }
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router; 