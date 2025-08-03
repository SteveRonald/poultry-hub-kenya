import express from 'express';
import pool from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from './authMiddleware.js';
import crypto from 'crypto';

const router = express.Router();

// GET all users (example)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user_profiles');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// POST /register
router.post('/register', async (req, res) => {
  const { email, password, full_name, phone, role, farm_name, farm_description, location, id_number } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const [existing] = await pool.query('SELECT id FROM user_profiles WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO user_profiles (id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, hashed, full_name, phone || null, role || 'customer']
    );
    // If vendor, insert into vendors table
    if (role === 'vendor') {
      const vendorId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO vendors (id, user_id, farm_name, farm_description, location, id_number) VALUES (?, ?, ?, ?, ?, ?)',
        [vendorId, id, farm_name, farm_description || '', location, id_number || null]
      );
    }
    res.status(201).json({ message: 'User registered', id });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }
  try {
    const [users] = await pool.query('SELECT * FROM user_profiles WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Example protected route
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, email, full_name, phone, role FROM user_profiles WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

export default router; 