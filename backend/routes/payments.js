import express from 'express';
import pool from '../db.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
const router = express.Router();

// Paystack payment initialization
router.post('/paystack/initialize', async (req, res) => {
  try {
    const { order_id, amount, email, callback_url } = req.body;

    if (!order_id || !amount || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: order_id, amount, email'
      });
    }

    // Verify order exists and belongs to user
    const [orders] = await pool.query(
      'SELECT id, user_id, total_amount, payment_status FROM orders WHERE id = ?',
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    // Check if order is already paid
    if (order.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order is already paid'
      });
    }

    // Generate Paystack transaction reference
    const reference = `PHK-${order_id}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Store transaction record BEFORE calling Paystack
    await pool.query(`
      INSERT INTO payment_transactions (
        transaction_reference, order_id, user_id, amount, currency,
        payment_method, payment_status, metadata, created_at
      ) VALUES (?, ?, ?, ?, 'KES', 'paystack', 'pending', ?, NOW())
    `, [
      reference,
      order_id,
      order.user_id,
      amount,
      JSON.stringify({ initialized_at: new Date().toISOString() })
    ]);

    // Paystack API integration
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return res.status(500).json({
        success: false,
        error: 'Paystack configuration missing'
      });
    }

    const paystackData = {
      email: email,
      amount: amount * 100, // Convert to kobo
      reference: reference,
      callback_url: callback_url || `${process.env.APP_URL || 'http://localhost:8080'}/checkout/success`
    };

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paystackData)
    });

    const paystackResult = await paystackResponse.json();

    if (!paystackResult.status) {
      // Update transaction status to failed
      await pool.query(`
        UPDATE payment_transactions SET
          payment_status = 'failed',
          gateway_response = ?,
          updated_at = NOW()
        WHERE transaction_reference = ?
      `, [JSON.stringify(paystackResult), reference]);

      return res.status(400).json({
        success: false,
        error: paystackResult.message || 'Payment initialization failed'
      });
    }

    // Update transaction with Paystack access code
    await pool.query(`
      UPDATE payment_transactions SET
        paystack_access_code = ?,
        gateway_response = ?,
        updated_at = NOW()
      WHERE transaction_reference = ?
    `, [
      paystackResult.data.access_code,
      JSON.stringify(paystackResult),
      reference
    ]);

    res.json({
      success: true,
      data: paystackResult.data,
      order_id: order_id,
      reference: reference
    });

  } catch (error) {
    console.error('Paystack initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize payment'
    });
  }
});

// Paystack payment verification
router.get('/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    // Get transaction details
    const [transactions] = await pool.query(
      'SELECT * FROM payment_transactions WHERE transaction_reference = ?',
      [reference]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    const transaction = transactions[0];

    // Paystack API verification
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return res.status(500).json({
        success: false,
        error: 'Paystack configuration missing'
      });
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      }
    });

    const verificationResult = await verifyResponse.json();

    if (!verificationResult.status) {
      return res.status(400).json({
        success: false,
        error: verificationResult.message || 'Payment verification failed'
      });
    }

    // Update transaction and order status based on verification
    const paymentStatus = verificationResult.data.status === 'success' ? 'success' : 'failed';

    await pool.query(`
      UPDATE payment_transactions SET
        payment_status = ?,
        paystack_transaction_id = ?,
        paystack_paid_at = ?,
        gateway_response = ?,
        updated_at = NOW()
      WHERE transaction_reference = ?
    `, [
      paymentStatus,
      verificationResult.data.id,
      verificationResult.data.paid_at ? new Date(verificationResult.data.paid_at) : null,
      JSON.stringify(verificationResult),
      reference
    ]);

    // Update order payment status only if payment was successful
    if (paymentStatus === 'success') {
      await pool.query(`
        UPDATE orders SET
          payment_status = 'paid',
          payment_transaction_id = ?,
          payment_completed_at = NOW(),
          payment_reference = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        verificationResult.data.id,
        reference,
        transaction.order_id
      ]);
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: verificationResult.data,
      order_id: transaction.order_id
    });

  } catch (error) {
    console.error('Paystack verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Paystack webhook handler
router.post('/paystack/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-paystack-signature'];

    // Verify webhook signature for security
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (paystackSecret) {
      const expectedSignature = crypto.createHmac('sha512', paystackSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.warn('Invalid webhook signature received');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    // Store webhook data first (source of truth)
    await pool.query(`
      INSERT INTO payment_webhooks (
        paystack_event_id, event_type, transaction_reference,
        webhook_data, processed_at, created_at
      ) VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [
      payload.id,
      payload.event,
      payload.data?.reference || null,
      JSON.stringify(payload)
    ]);

    // Process webhook based on event type
    if (payload.event === 'charge.success') {
      const reference = payload.data.reference;

      // Update payment status - webhook is the source of truth
      await pool.query(`
        UPDATE payment_transactions SET
          payment_status = 'success',
          paystack_transaction_id = ?,
          paystack_paid_at = ?,
          gateway_response = ?,
          updated_at = NOW()
        WHERE transaction_reference = ?
      `, [
        payload.data.id,
        new Date(payload.data.paid_at),
        JSON.stringify(payload),
        reference
      ]);

      // Update order status
      const [transactions] = await pool.query(
        'SELECT order_id FROM payment_transactions WHERE transaction_reference = ?',
        [reference]
      );

      if (transactions.length > 0) {
        await pool.query(`
          UPDATE orders SET
            payment_status = 'paid',
            payment_transaction_id = ?,
            payment_completed_at = NOW(),
            payment_reference = ?,
            updated_at = NOW()
          WHERE id = ?
        `, [
          payload.data.id,
          reference,
          transactions[0].order_id
        ]);
      }
    } else if (payload.event === 'charge.failed') {
      // Handle failed payments
      const reference = payload.data.reference;
      await pool.query(`
        UPDATE payment_transactions SET
          payment_status = 'failed',
          gateway_response = ?,
          updated_at = NOW()
        WHERE transaction_reference = ?
      `, [JSON.stringify(payload), reference]);
    }

    // Always respond with 200 to acknowledge receipt
    res.json({ success: true, received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Paystack from retrying
    res.status(200).json({ success: false, error: 'Processing failed but acknowledged' });
  }
});

// GET payment status
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const [orders] = await pool.query(`
      SELECT
        o.id, o.payment_status, o.payment_transaction_id,
        o.payment_reference, o.payment_completed_at,
        pt.transaction_reference, pt.paystack_transaction_id,
        pt.paystack_paid_at, pt.gateway_response
      FROM orders o
      LEFT JOIN payment_transactions pt ON o.id = pt.order_id
      WHERE o.id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    res.json({
      success: true,
      data: {
        order_id: order.id,
        payment_status: order.payment_status,
        payment_reference: order.payment_reference,
        transaction_id: order.paystack_transaction_id,
        paid_at: order.paystack_paid_at,
        completed_at: order.payment_completed_at,
        gateway_response: order.gateway_response ? JSON.parse(order.gateway_response) : null
      }
    });

  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status'
    });
  }
});

// GET all payments (admin)
router.get('/', async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT
        pt.*,
        o.order_number,
        u.full_name as customer_name,
        u.email as customer_email
      FROM payment_transactions pt
      JOIN orders o ON pt.order_id = o.id
      JOIN user_profiles u ON pt.user_id = u.id
      ORDER BY pt.created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
});

export default router;
