import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

// Strict 2-User Account Database
interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isOnline: boolean;
  status: 'available' | 'calling' | 'in-call' | 'offline';
  lastSeen: number;
}

const USERS: Map<string, UserAccount> = new Map([
  [
    'user1',
    {
      id: 'user1',
      email: 'user1@duocall.com',
      passwordHash: 'password123',
      displayName: 'Person 1 (Mohamed)',
      isOnline: false,
      status: 'offline',
      lastSeen: Date.now(),
    },
  ],
  [
    'user2',
    {
      id: 'user2',
      email: 'user2@duocall.com',
      passwordHash: 'password123',
      displayName: 'Person 2 (Partner)',
      isOnline: false,
      status: 'offline',
      lastSeen: Date.now(),
    },
  ],
]);

interface PeerSocket extends WebSocket {
  id: string;
  userId?: string;
  isAlive?: boolean;
}

// Track active WebSocket connections per userId
const activeUserSockets = new Map<string, PeerSocket>();
const signalQueues = new Map<string, any[]>();

const app = express();
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function sendSignalToUser(targetUserId: string, payload: any): boolean {
  let delivered = false;
  const ws = activeUserSockets.get(targetUserId);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    delivered = true;
  }

  // Queue for HTTP polling safety net
  let queue = signalQueues.get(targetUserId);
  if (!queue) {
    queue = [];
    signalQueues.set(targetUserId, queue);
  }
  queue.push(payload);
  if (queue.length > 100) queue.shift();

  return delivered;
}

function broadcastPresence() {
  const userList = Array.from(USERS.values()).map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    isOnline: u.isOnline,
    status: u.status,
    lastSeen: u.lastSeen,
  }));

  const payload = { type: 'presence-update', users: userList };

  activeUserSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  });
}

// Presence Heartbeat check
setInterval(() => {
  const now = Date.now();
  USERS.forEach((u) => {
    const ws = activeUserSockets.get(u.id);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (now - u.lastSeen > 30000 && u.isOnline) {
        u.isOnline = false;
        u.status = 'offline';
        activeUserSockets.delete(u.id);
      }
    }
  });

  wss.clients.forEach((ws) => {
    const peer = ws as PeerSocket;
    if (peer.isAlive === false) return peer.terminate();
    peer.isAlive = false;
    peer.ping();
  });

  broadcastPresence();
}, 15000);

// WebSocket Connections
wss.on('connection', (ws: WebSocket) => {
  const peer = ws as PeerSocket;
  peer.id = Math.random().toString(36).substring(2, 10);
  peer.isAlive = true;

  peer.on('pong', () => {
    peer.isAlive = true;
  });

  peer.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'auth-connect': {
          const { userId } = msg;
          const user = USERS.get(userId);
          if (user) {
            peer.userId = userId;
            user.isOnline = true;
            user.status = 'available';
            user.lastSeen = Date.now();
            activeUserSockets.set(userId, peer);

            peer.send(
              JSON.stringify({
                type: 'auth-success',
                user: { id: user.id, email: user.email, displayName: user.displayName },
              })
            );

            broadcastPresence();
          }
          break;
        }

        case 'direct-call-init': {
          const { callerId, targetUserId } = msg;
          const caller = USERS.get(callerId);
          const target = USERS.get(targetUserId);

          if (!caller || !target) return;

          caller.status = 'calling';
          broadcastPresence();

          sendSignalToUser(targetUserId, {
            type: 'incoming-call',
            caller: { id: caller.id, displayName: caller.displayName, email: caller.email },
          });
          break;
        }

        case 'direct-call-accept': {
          const { callerId, responderId } = msg;
          const caller = USERS.get(callerId);
          const responder = USERS.get(responderId);

          if (caller) caller.status = 'in-call';
          if (responder) responder.status = 'in-call';
          broadcastPresence();

          sendSignalToUser(callerId, {
            type: 'call-accepted',
            responderId,
          });
          break;
        }

        case 'direct-call-decline': {
          const { callerId, responderId } = msg;
          const caller = USERS.get(callerId);
          const responder = USERS.get(responderId);

          if (caller) caller.status = 'available';
          if (responder) responder.status = 'available';
          broadcastPresence();

          sendSignalToUser(callerId, {
            type: 'call-declined',
            responderId,
          });
          break;
        }

        case 'direct-call-end': {
          const { userId, partnerId } = msg;
          const user = USERS.get(userId);
          const partner = USERS.get(partnerId);

          if (user) user.status = 'available';
          if (partner) partner.status = 'available';
          broadcastPresence();

          if (partnerId) {
            sendSignalToUser(partnerId, { type: 'call-ended', endedBy: userId });
          }
          break;
        }

        // WebRTC Signals
        case 'offer':
        case 'answer':
        case 'ice-candidate':
        case 'media-state':
        case 'chat-message':
        case 'media-chunk': {
          if (msg.targetUserId) {
            sendSignalToUser(msg.targetUserId, { ...msg, senderId: peer.userId });
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  peer.on('close', () => {
    if (peer.userId) {
      const u = USERS.get(peer.userId);
      if (u) {
        u.isOnline = false;
        u.status = 'offline';
        u.lastSeen = Date.now();
        activeUserSockets.delete(peer.userId);
        broadcastPresence();
      }
    }
  });
});

// REST Authentication API
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = Array.from(USERS.values()).find(
    (u) => u.email.toLowerCase() === email.toLowerCase().trim() && u.passwordHash === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid user email or password.' });
  }

  user.isOnline = true;
  user.status = 'available';
  user.lastSeen = Date.now();

  res.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
    partner: Array.from(USERS.values())
      .filter((u) => u.id !== user.id)
      .map((u) => ({ id: u.id, email: u.email, displayName: u.displayName, isOnline: u.isOnline, status: u.status }))[0],
  });
});

app.post('/api/auth/update-profile', (req, res) => {
  const { userId, displayName } = req.body;
  const user = USERS.get(userId);
  if (user && displayName) {
    user.displayName = displayName.trim();
    broadcastPresence();
    return res.json({ success: true, displayName: user.displayName });
  }
  res.status(400).json({ error: 'Invalid request' });
});

app.get('/api/users/presence', (req, res) => {
  const userList = Array.from(USERS.values()).map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    isOnline: u.isOnline,
    status: u.status,
    lastSeen: u.lastSeen,
  }));
  res.json({ users: userList });
});

app.post('/api/signaling/send', (req, res) => {
  const { targetUserId, signal } = req.body;
  if (!targetUserId || !signal) return res.status(400).json({ error: 'Missing parameters' });
  sendSignalToUser(targetUserId, signal);
  res.json({ success: true });
});

app.get('/api/signaling/poll', (req, res) => {
  const { userId } = req.query as { userId: string };
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const u = USERS.get(userId);
  if (u) {
    u.isOnline = true;
    u.lastSeen = Date.now();
  }

  const queue = signalQueues.get(userId) || [];
  const signals = [...queue];
  signalQueues.set(userId, []);

  res.json({ signals });
});

app.get('/api/ice-servers', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    usersOnline: Array.from(USERS.values()).filter((u) => u.isOnline).length,
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`DuoCall server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
