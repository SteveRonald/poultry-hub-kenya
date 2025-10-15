import express from 'express';
import pool from '../db.js';
import { authenticateToken } from './authMiddleware.js';
import fetch from 'node-fetch';
const router = express.Router();

// GET all orders (optionally filter by user_id or vendor_id)
router.get('/', authenticateToken, async (req, res) => {
  const { user_id, vendor_id } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (user_id) {
    sql += ' AND user_id = ?';
    params.push(user_id);
  }
  if (vendor_id) {
    sql += ' AND product_id IN (SELECT id FROM products WHERE vendor_id = ?)';
    params.push(vendor_id);
  }
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET single order
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// CREATE order
router.post('/', authenticateToken, async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'Missing required fields' });
  try {
    await pool.query(
      'INSERT INTO orders (user_id, product_id, quantity) VALUES (?, ?, ?)',
      [req.user.id, product_id, quantity]
    );
    // Notify vendor
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.body.product_id]);
    const product = products[0];
    const [vendors] = await pool.query('SELECT * FROM vendors WHERE id = ?', [product.vendor_id]);
    const vendor = vendors[0];
    await fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
      body: JSON.stringify({ user_id: vendor.user_id, message: `You have a new order for product #${product.id}` }),
    });
    res.status(201).json({ message: 'Order created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
});

// UPDATE order (status or quantity)
router.put('/:id', authenticateToken, async (req, res) => {
  const { status, quantity } = req.body;
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    // Only allow update if user is owner or admin
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(
      'UPDATE orders SET status=?, quantity=? WHERE id=?',
      [status || order.status, quantity || order.quantity, req.params.id]
    );
    // Notify customer
    await fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
      body: JSON.stringify({ user_id: order.user_id, message: `Your order #${order.id} status changed to ${req.body.status}` }),
    });
    res.json({ message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order', details: err.message });
  }
});

// DELETE order
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order', details: err.message });
  }
});

export default router; 