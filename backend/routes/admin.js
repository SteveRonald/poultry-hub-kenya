import express from 'express';
import pool from '../db.js';
import { authenticateToken } from './authMiddleware.js';
const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// GET site-wide stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [[{ userCount }]] = await pool.query('SELECT COUNT(*) as userCount FROM user_profiles');
    const [[{ vendorCount }]] = await pool.query('SELECT COUNT(*) as vendorCount FROM vendors');
    const [[{ productCount }]] = await pool.query('SELECT COUNT(*) as productCount FROM products');
    const [[{ orderCount }]] = await pool.query('SELECT COUNT(*) as orderCount FROM orders');
    const [[{ revenue }]] = await pool.query('SELECT IFNULL(SUM(amount),0) as revenue FROM payments WHERE status = "completed"');
    res.json({ userCount, vendorCount, productCount, orderCount, revenue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// GET all vendors
router.get('/vendors', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vendors');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendors', details: err.message });
  }
});

// Approve/reject/suspend vendor
router.put('/vendors/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    await pool.query('UPDATE vendors SET status = ? WHERE id = ?', [status, req.params.id]);
    const [vendors] = await pool.query('SELECT * FROM vendors WHERE id = ?', [req.params.id]);
    const vendor = vendors[0];
    await fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` },
      body: JSON.stringify({ user_id: vendor.user_id, message: `Your vendor status changed to ${status}` }),
    });
    res.json({ message: 'Vendor status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vendor status', details: err.message });
  }
});

// GET all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user_profiles');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// GET all orders
router.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

// GET all products
router.get('/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// Approve/reject product
router.put('/products/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    await pool.query('UPDATE products SET status = ? WHERE id = ?', [status, req.params.id]);
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    const product = products[0];
    await fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}` },
      body: JSON.stringify({ user_id: product.vendor_id, message: `Your product #${product.id} status changed to ${status}` }),
    });
    res.json({ message: 'Product status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product status', details: err.message });
  }
});

// Edit user
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { email, full_name, phone, role } = req.body;
  try {
    await pool.query('UPDATE user_profiles SET email=?, full_name=?, phone=?, role=? WHERE id=?', [email, full_name, phone, role, req.params.id]);
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// Delete user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_profiles WHERE id=?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

export default router; 