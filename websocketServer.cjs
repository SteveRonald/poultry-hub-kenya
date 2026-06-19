const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const PORT = process.env.WS_PORT || 4000;
const BASE_URL = process.env.BASE_URL || 'http://localhost/poultry-hub-kenya';

const wss = new WebSocket.Server({ port: PORT });
const clients = new Map(); // userId => ws

function safeParse(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

// Validate admin session token from backend (if JWT validation fails)
async function validateAdminSession(sessionToken) {
  try {
    // Query PHP backend to validate admin session
    const response = await fetch(`${BASE_URL}/backend/api/admin/session/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` }
    });
    if (response.ok) {
      const data = await response.json();
      return data; // should contain admin_id or user_id
    }
    return null;
  } catch (e) {
    console.error('Failed to validate admin session', e);
    return null;
  }
}

wss.on('connection', async (ws, req) => {
  try {
    const url = new URL(req.url, `http://localhost`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'missing token');
      return;
    }

    let payload = null;
    let userId = null;
    let isAdmin = false;

    // Try JWT first
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
      userId = payload.user_id || payload.id || payload.sub;
    } catch (e) {
      // JWT failed, try admin session validation
      const adminData = await validateAdminSession(token);
      if (adminData && (adminData.admin_id || adminData.user_id)) {
        userId = adminData.admin_id || adminData.user_id;
        isAdmin = true;
      } else {
        ws.close(4002, 'invalid token or admin session');
        return;
      }
    }

    if (!userId) {
      ws.close(4003, 'invalid token payload');
      return;
    }

    clients.set(String(userId), ws);
    ws.userId = String(userId);
    ws.isAdmin = isAdmin;

    ws.send(JSON.stringify({ type: 'connected', userId: ws.userId, isAdmin: ws.isAdmin }));

    ws.on('message', async (message) => {
      const data = safeParse(message);
      if (!data) return;

      if (data.type === 'message') {
        // persist via PHP API
        try {
          await fetch(`${BASE_URL}/backend/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ product_id: data.product_id, receiver_id: data.receiver_id, message: data.message })
          });
        } catch (e) {
          console.error('Failed to persist message', e);
        }

        // forward to receiver if connected
        const recv = clients.get(String(data.receiver_id));
        if (recv && recv.readyState === WebSocket.OPEN) {
          recv.send(JSON.stringify({
            type: 'message',
            from: ws.userId,
            product_id: data.product_id,
            message: data.message,
            created_at: new Date().toISOString()
          }));
        }
      }
    });

    ws.on('close', () => {
      clients.delete(ws.userId);
    });

  } catch (err) {
    console.error('connection error', err);
    ws.close(1011, 'server error');
  }
});

console.log(`WebSocket server listening on ws://localhost:${PORT}`);
