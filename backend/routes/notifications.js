import express from 'express';
import pool from '../db.js';
import { authenticateToken } from './authMiddleware.js';
const router = express.Router();

// Get notifications for logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
});

// Create notification
router.post('/', authenticateToken, async (req, res) => {
  const { user_id, message } = req.body;
  if (!user_id || !message) return res.status(400).json({ error: 'Missing user_id or message' });
  try {
    await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [user_id, message]);
    res.status(201).json({ message: 'Notification created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create notification', details: err.message });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification', details: err.message });
  }
});

export default router; 