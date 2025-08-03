import express from 'express';
import pool from '../db.js';
import { authenticateToken } from './authMiddleware.js';
const router = express.Router();

function requireVendor(req, res, next) {
  if (req.user.role !== 'vendor') return res.status(403).json({ error: 'Vendor only' });
  next();
}

// GET vendor stats
router.get('/stats', authenticateToken, requireVendor, async (req, res) => {
  try {
    const [[{ productCount }]] = await pool.query('SELECT COUNT(*) as productCount FROM products WHERE vendor_id = (SELECT id FROM vendors WHERE user_id = ?)', [req.user.id]);
    const [[{ orderCount }]] = await pool.query('SELECT COUNT(*) as orderCount FROM orders WHERE product_id IN (SELECT id FROM products WHERE vendor_id = (SELECT id FROM vendors WHERE user_id = ?))', [req.user.id]);
    const [[{ revenue }]] = await pool.query('SELECT IFNULL(SUM(amount),0) as revenue FROM payments WHERE order_id IN (SELECT id FROM orders WHERE product_id IN (SELECT id FROM products WHERE vendor_id = (SELECT id FROM vendors WHERE user_id = ?))) AND status = "completed"', [req.user.id]);
    res.json({ productCount, orderCount, revenue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// CRUD for vendor's own products
router.get('/products', authenticateToken, requireVendor, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE vendor_id = (SELECT id FROM vendors WHERE user_id = ?)', [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

router.post('/products', authenticateToken, requireVendor, async (req, res) => {
  const { name, description, category, price, stock_quantity, unit, image_urls, is_active } = req.body;
  if (!name || !category || !price) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const [vendors] = await pool.query('SELECT id, status FROM vendors WHERE user_id = ?', [req.user.id]);
    if (vendors.length === 0) return res.status(400).json({ error: 'Vendor profile not found' });
    const vendor = vendors[0];
    if (vendor.status !== 'approved') return res.status(403).json({ error: 'Your vendor account is not approved yet.' });
    const vendor_id = vendor.id;
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO products (id, vendor_id, name, description, category, price, stock_quantity, unit, image_urls, is_active, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, vendor_id, name, description || '', category, price, stock_quantity || 0, unit || 'piece', JSON.stringify(image_urls || []), is_active !== undefined ? is_active : true, 'pending']
    );
    res.status(201).json({ message: 'Product created and pending admin approval', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
});

router.put('/products/:id', authenticateToken, requireVendor, async (req, res) => {
  const { name, description, category, price, stock_quantity, unit, image_urls, is_active } = req.body;
  try {
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = products[0];
    // Only allow update if product belongs to vendor
    const [vendors] = await pool.query('SELECT id FROM vendors WHERE user_id = ?', [req.user.id]);
    if (vendors.length === 0 || product.vendor_id !== vendors[0].id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query(
      'UPDATE products SET name=?, description=?, category=?, price=?, stock_quantity=?, unit=?, image_urls=?, is_active=? WHERE id=?',
      [name || product.name, description || product.description, category || product.category, price || product.price, stock_quantity || product.stock_quantity, unit || product.unit, JSON.stringify(image_urls || product.image_urls), is_active !== undefined ? is_active : product.is_active, req.params.id]
    );
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
});

router.delete('/products/:id', authenticateToken, requireVendor, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = products[0];
    const [vendors] = await pool.query('SELECT id FROM vendors WHERE user_id = ?', [req.user.id]);
    if (vendors.length === 0 || product.vendor_id !== vendors[0].id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
});

// Orders for vendor's products
router.get('/orders', authenticateToken, requireVendor, async (req, res) => {
  try {
    const [vendors] = await pool.query('SELECT id FROM vendors WHERE user_id = ?', [req.user.id]);
    if (vendors.length === 0) return res.status(400).json({ error: 'Vendor profile not found' });
    const vendor_id = vendors[0].id;
    const [rows] = await pool.query('SELECT * FROM orders WHERE product_id IN (SELECT id FROM products WHERE vendor_id = ?)', [vendor_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

// Update order status (for vendor's products)
router.put('/orders/:id/status', authenticateToken, requireVendor, async (req, res) => {
  const { status } = req.body;
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [order.product_id]);
    if (products.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = products[0];
    const [vendors] = await pool.query('SELECT id FROM vendors WHERE user_id = ?', [req.user.id]);
    if (vendors.length === 0 || product.vendor_id !== vendors[0].id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: 'Order status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status', details: err.message });
  }
});

export default router; 