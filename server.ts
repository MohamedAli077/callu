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

interface PeerSocket extends WebSocket {
  id: string;
  roomId?: string;
  displayName?: string;
  isAlive?: boolean;
}

interface RoomPeer {
  id: string;
  displayName: string;
  lastActive: number;
}

interface Room {
  id: string;
  peers: Map<string, RoomPeer>;
  wsPeers: Map<string, PeerSocket>;
  createdAt: number;
}

const rooms = new Map<string, Room>();
const signalQueues = new Map<string, any[]>();

const app = express();
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Cleanup inactive rooms every 30 seconds
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, roomId) => {
    room.peers.forEach((peer, peerId) => {
      const ws = room.wsPeers.get(peerId);
      if (now - peer.lastActive > 45000 && (!ws || ws.readyState !== WebSocket.OPEN)) {
        room.peers.delete(peerId);
        room.wsPeers.delete(peerId);
        signalQueues.delete(peerId);
      }
    });

    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  });
}, 30000);

function deliverSignal(targetPeerId: string, signal: any) {
  let delivered = false;

  rooms.forEach((room) => {
    const ws = room.wsPeers.get(targetPeerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(signal));
      delivered = true;
    }
  });

  let queue = signalQueues.get(targetPeerId);
  if (!queue) {
    queue = [];
    signalQueues.set(targetPeerId, queue);
  }
  queue.push(signal);
  if (queue.length > 100) queue.shift();

  return delivered;
}

function broadcastToRoom(roomId: string, senderId: string, signal: any) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.peers.forEach((_, peerId) => {
    if (peerId !== senderId) {
      deliverSignal(peerId, signal);
    }
  });
}

// Heartbeat ping
setInterval(() => {
  wss.clients.forEach((ws) => {
    const peer = ws as PeerSocket;
    if (peer.isAlive === false) return peer.terminate();
    peer.isAlive = false;
    peer.ping();
  });
}, 25000);

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
        case 'join-room': {
          const { roomId, displayName } = msg;
          if (!roomId) return;

          peer.displayName = displayName || 'Peer';

          let room = rooms.get(roomId);
          if (!room) {
            room = {
              id: roomId,
              peers: new Map(),
              wsPeers: new Map(),
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
          }

          if (room.peers.size >= 2 && !room.peers.has(peer.id)) {
            peer.send(
              JSON.stringify({
                type: 'room-full',
                roomId,
                message: 'This 1-on-1 direct line is full (maximum 2 participants allowed).',
              })
            );
            return;
          }

          peer.roomId = roomId;
          room.peers.set(peer.id, {
            id: peer.id,
            displayName: peer.displayName || 'Peer',
            lastActive: Date.now(),
          });
          room.wsPeers.set(peer.id, peer);

          const existingPeers = Array.from(room.peers.values()).filter((p) => p.id !== peer.id);

          peer.send(
            JSON.stringify({
              type: 'room-joined',
              roomId,
              peerId: peer.id,
              peersCount: room.peers.size,
              otherPeer: existingPeers[0] || null,
            })
          );

          if (existingPeers.length > 0) {
            broadcastToRoom(roomId, peer.id, {
              type: 'peer-joined',
              peerId: peer.id,
              displayName: peer.displayName || 'Peer',
              peersCount: room.peers.size,
            });
          }
          break;
        }

        case 'offer':
        case 'answer':
        case 'ice-candidate':
        case 'call-ring':
        case 'call-accept':
        case 'call-decline':
        case 'call-hangup':
        case 'media-state':
        case 'chat-message':
        case 'media-chunk': {
          if (peer.roomId) {
            broadcastToRoom(peer.roomId, peer.id, {
              ...msg,
              senderId: peer.id,
              senderName: peer.displayName,
            });
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('WS Error handling message:', err);
    }
  });

  peer.on('close', () => {
    if (peer.roomId) {
      const room = rooms.get(peer.roomId);
      if (room) {
        room.wsPeers.delete(peer.id);
        broadcastToRoom(peer.roomId, peer.id, {
          type: 'peer-left',
          peerId: peer.id,
          displayName: peer.displayName || 'Partner',
          peersCount: room.peers.size - 1,
        });
      }
    }
  });
});

// REST Fallback APIs
app.post('/api/signaling/join', (req, res) => {
  const { roomId, displayName, peerId: existingPeerId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      peers: new Map(),
      wsPeers: new Map(),
      createdAt: Date.now(),
    };
    rooms.set(roomId, room);
  }

  const peerId = existingPeerId || Math.random().toString(36).substring(2, 10);

  if (room.peers.size >= 2 && !room.peers.has(peerId)) {
    return res.status(403).json({
      type: 'room-full',
      message: 'This 1-on-1 direct call line is full (2 persons max).',
    });
  }

  room.peers.set(peerId, {
    id: peerId,
    displayName: displayName || 'Peer',
    lastActive: Date.now(),
  });

  const existingPeers = Array.from(room.peers.values()).filter((p) => p.id !== peerId);

  if (existingPeers.length > 0) {
    broadcastToRoom(roomId, peerId, {
      type: 'peer-joined',
      peerId,
      displayName: displayName || 'Peer',
      peersCount: room.peers.size,
    });
  }

  res.json({
    type: 'room-joined',
    roomId,
    peerId,
    peersCount: room.peers.size,
    otherPeer: existingPeers[0] || null,
  });
});

app.post('/api/signaling/send', (req, res) => {
  const { roomId, senderId, signal } = req.body;
  if (!roomId || !signal) return res.status(400).json({ error: 'Invalid payload' });

  broadcastToRoom(roomId, senderId, signal);
  res.json({ success: true });
});

app.get('/api/signaling/poll', (req, res) => {
  const { roomId, peerId } = req.query as { roomId: string; peerId: string };
  if (!peerId) return res.status(400).json({ error: 'Missing peerId' });

  if (roomId) {
    const room = rooms.get(roomId);
    if (room && room.peers.has(peerId)) {
      const p = room.peers.get(peerId)!;
      p.lastActive = Date.now();
    }
  }

  const queue = signalQueues.get(peerId) || [];
  const signals = [...queue];
  signalQueues.set(peerId, []);

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
    activeRooms: rooms.size,
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
