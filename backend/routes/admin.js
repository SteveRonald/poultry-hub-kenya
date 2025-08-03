import express from 'express';
import pool from '../db.js';
import { authenticateToken, authenticateAdminSession } from './authMiddleware.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// GET site-wide stats
router.get('/stats', authenticateAdminSession, requireAdmin, async (req, res) => {
  try {
    const [[{ totalVendors }]] = await pool.query('SELECT COUNT(*) as totalVendors FROM vendors');
    const [[{ pendingVendors }]] = await pool.query("SELECT COUNT(*) as pendingVendors FROM vendors WHERE status = 'pending'");
    const [[{ totalProducts }]] = await pool.query('SELECT COUNT(*) as totalProducts FROM products');
    const [[{ pendingProducts }]] = await pool.query("SELECT COUNT(*) as pendingProducts FROM products WHERE status = 'pending'");
    const [[{ totalOrders }]] = await pool.query('SELECT COUNT(*) as totalOrders FROM orders');
    const [[{ totalRevenue }]] = await pool.query('SELECT IFNULL(SUM(amount),0) as totalRevenue FROM payments WHERE status = "completed"');
    res.json({ totalVendors, pendingVendors, totalProducts, pendingProducts, totalOrders, totalRevenue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// GET all vendors
router.get('/vendors', authenticateAdminSession, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vendors');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendors', details: err.message });
  }
});

// Approve/reject/suspend vendor
router.put('/vendors/:id/status', authenticateAdminSession, requireAdmin, async (req, res) => {
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
router.get('/users', authenticateAdminSession, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user_profiles');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// GET all orders
router.get('/orders', authenticateAdminSession, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

// GET all products
router.get('/products', authenticateAdminSession, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// Approve/reject product
router.put('/products/:id/status', authenticateAdminSession, requireAdmin, async (req, res) => {
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
router.put('/users/:id', authenticateAdminSession, requireAdmin, async (req, res) => {
  const { email, full_name, phone, role } = req.body;
  try {
    await pool.query('UPDATE user_profiles SET email=?, full_name=?, phone=?, role=? WHERE id=?', [email, full_name, phone, role, req.params.id]);
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// Delete user
router.delete('/users/:id', authenticateAdminSession, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_profiles WHERE id=?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

// Admin login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }
  try {
    const [users] = await pool.query('SELECT * FROM user_profiles WHERE email = ? AND role = ?', [email, 'admin']);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Create session token
    const session_token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await pool.query(
      'INSERT INTO admin_sessions (admin_id, session_token, expires_at) VALUES (?, ?, ?)',
      [user.id, session_token, expires_at]
    );
    res.json({ session_token, admin: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Admin login failed', details: err.message });
  }
});

export default router; 