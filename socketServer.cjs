// Socket.IO Server for Real-Time Chat
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const PORT = process.env.WS_PORT || 4000;
const BASE_URL = process.env.BASE_URL || 'http://localhost/poultry-hub-kenya';
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'your-secret-key';

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active users and their socket connections
const activeUsers = new Map(); // userId => socketId
const userSockets = new Map(); // socketId => { userId, role, conversationIds: Set }

// Validate JWT token
function validateToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Validate admin session (fallback)
async function validateAdminSession(sessionToken) {
  try {
    const response = await fetch(`${BASE_URL}/backend/api/admin/session/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` }
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (e) {
    console.error('Failed to validate admin session', e);
    return null;
  }
}

io.on('connection', async (socket) => {
  console.log('Client connecting...');

  // Authenticate on connection
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  
  if (!token) {
    socket.emit('error', { message: 'Authentication token required' });
    socket.disconnect();
    return;
  }

  let payload = null;
  let userId = null;
  let userRole = null;

  // Try JWT first
  payload = validateToken(token);
  if (payload) {
    userId = payload.user_id || payload.id || payload.sub;
    userRole = payload.role || 'customer';
  } else {
    // Try admin session
    const adminData = await validateAdminSession(token);
    if (adminData && (adminData.admin_id || adminData.user_id)) {
      userId = adminData.admin_id || adminData.user_id;
      userRole = 'admin';
    }
  }

  if (!userId) {
    socket.emit('error', { message: 'Invalid authentication token' });
    socket.disconnect();
    return;
  }

  // Store user connection
  activeUsers.set(String(userId), socket.id);
  userSockets.set(socket.id, {
    userId: String(userId),
    role: userRole,
    conversationIds: new Set()
  });

  console.log(`User ${userId} (${userRole}) connected with socket ${socket.id}`);

  socket.emit('connected', {
    userId: String(userId),
    role: userRole,
    socketId: socket.id
  });

  // Join conversation room
  socket.on('join_conversation', async (data) => {
    const { conversationId } = data;
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' });
      return;
    }

    const userInfo = userSockets.get(socket.id);
    if (!userInfo) return;

    // Join the conversation room
    socket.join(`conversation:${conversationId}`);
    userInfo.conversationIds.add(conversationId);

    console.log(`User ${userInfo.userId} joined conversation ${conversationId}`);
    socket.emit('joined_conversation', { conversationId });
  });

  // Leave conversation room
  socket.on('leave_conversation', (data) => {
    const { conversationId } = data;
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`);
      const userInfo = userSockets.get(socket.id);
      if (userInfo) {
        userInfo.conversationIds.delete(conversationId);
        // Notify others in the conversation that this user is offline
        socket.to(`conversation:${conversationId}`).emit('user_offline', {
          userId: userInfo.userId,
          conversationId: conversationId
        });
      }
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    const { conversationId, messageText } = data;
    const userInfo = userSockets.get(socket.id);

    if (!userInfo || !conversationId || !messageText) {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }

    try {
      // Persist message via PHP API
      const response = await fetch(`${BASE_URL}/backend/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_text: messageText
        })
      });

      if (!response.ok) {
        const error = await response.json();
        socket.emit('error', { message: error.error || 'Failed to send message' });
        return;
      }

      const result = await response.json();
      const message = result.message;

      // Emit to all users in the conversation room
      io.to(`conversation:${conversationId}`).emit('receive_message', {
        id: message.id,
        conversation_id: conversationId,
        sender_id: userInfo.userId,
        sender_role: userInfo.role,
        message_text: messageText,
        is_read: false,
        created_at: message.created_at
      });

      console.log(`Message sent in conversation ${conversationId} by user ${userInfo.userId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { conversationId, isTyping } = data;
    const userInfo = userSockets.get(socket.id);

    if (!userInfo || !conversationId) return;

    // Broadcast typing status to other users in the conversation
    socket.to(`conversation:${conversationId}`).emit('typing', {
      userId: userInfo.userId,
      isTyping: isTyping || false
    });
  });

  // Mark messages as read
  socket.on('mark_read', async (data) => {
    const { conversationId } = data;
    const userInfo = userSockets.get(socket.id);

    if (!userInfo || !conversationId) return;

    try {
      await fetch(`${BASE_URL}/backend/api/messages/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ conversation_id: conversationId })
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      console.log(`User ${userInfo.userId} disconnected`);
      
      // Remove from active users
      activeUsers.delete(userInfo.userId);
      
      // Notify all conversations that user left
      userInfo.conversationIds.forEach(conversationId => {
        socket.to(`conversation:${conversationId}`).emit('user_offline', {
          userId: userInfo.userId,
          conversationId: conversationId
        });
      });
      
      userSockets.delete(socket.id);
    }
  });

  // Handle user online status check
  socket.on('check_user_online', (data) => {
    const { userId, conversationId } = data;
    const targetSocketId = activeUsers.get(String(userId));
    const isOnline = targetSocketId !== undefined;
    
    socket.emit('user_online_status', {
      userId: String(userId),
      conversationId: conversationId,
      isOnline: isOnline
    });
  });
});

// Get online users for a conversation
io.getOnlineUsers = (conversationId) => {
  const onlineUsers = new Set();
  const room = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
  if (room) {
    for (const socketId of room) {
      const userInfo = userSockets.get(socketId);
      if (userInfo) {
        onlineUsers.add(userInfo.userId);
      }
    }
  }
  return Array.from(onlineUsers);
};

server.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});

module.exports = { io, server };

