import express from 'express';
import pool from '../db.js';
import { authenticateToken } from './authMiddleware.js';
const router = express.Router();

// GET all vendors
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vendors');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET single vendor
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// CREATE vendor (protected)
router.post('/', authenticateToken, async (req, res) => {
  const { farm_name, farm_description, location, id_number } = req.body;
  if (!farm_name || !location) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO vendors (id, user_id, farm_name, farm_description, location, id_number) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.user.id, farm_name, farm_description || '', location, id_number || null]
    );
    res.status(201).json({ message: 'Vendor created', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create vendor', details: err.message });
  }
});

// UPDATE vendor (protected, only owner or admin)
router.put('/:id', authenticateToken, async (req, res) => {
  const { farm_name, farm_description, location, id_number, status } = req.body;
  try {
    // Only allow update if user is owner or admin
    const [vendors] = await pool.query('SELECT * FROM vendors WHERE id = ?', [req.params.id]);
    if (vendors.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    const vendor = vendors[0];
    if (vendor.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(
      'UPDATE vendors SET farm_name=?, farm_description=?, location=?, id_number=?, status=? WHERE id=?',
      [farm_name || vendor.farm_name, farm_description || vendor.farm_description, location || vendor.location, id_number || vendor.id_number, status || vendor.status, req.params.id]
    );
    res.json({ message: 'Vendor updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vendor', details: err.message });
  }
});

// DELETE vendor (protected, only owner or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [vendors] = await pool.query('SELECT * FROM vendors WHERE id = ?', [req.params.id]);
    if (vendors.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    const vendor = vendors[0];
    if (vendor.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM vendors WHERE id = ?', [req.params.id]);
    res.json({ message: 'Vendor deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vendor', details: err.message });
  }
});

export default router; 