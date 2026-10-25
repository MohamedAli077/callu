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

interface Room {
  id: string;
  peers: Map<string, PeerSocket>;
  createdAt: number;
}

const rooms = new Map<string, Room>();

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Clean up stale heartbeats every 30 seconds
const interval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    const peer = ws as PeerSocket;
    if (peer.isAlive === false) {
      return peer.terminate();
    }
    peer.isAlive = false;
    peer.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

function broadcastToRoom(roomId: string, senderId: string, payload: any) {
  const room = rooms.get(roomId);
  if (!room) return;
  const messageString = JSON.stringify(payload);
  room.peers.forEach((peer, peerId) => {
    if (peerId !== senderId && peer.readyState === WebSocket.OPEN) {
      peer.send(messageString);
    }
  });
}

function leaveRoom(peer: PeerSocket) {
  if (!peer.roomId) return;
  const roomId = peer.roomId;
  const room = rooms.get(roomId);

  if (room) {
    room.peers.delete(peer.id);
    
    // Notify remaining peer
    broadcastToRoom(roomId, peer.id, {
      type: 'peer-left',
      peerId: peer.id,
      displayName: peer.displayName || 'Partner',
      peersCount: room.peers.size,
    });

    if (room.peers.size === 0) {
      rooms.delete(roomId);
    }
  }

  peer.roomId = undefined;
}

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

          // If peer was in another room, leave it
          if (peer.roomId) {
            leaveRoom(peer);
          }

          let room = rooms.get(roomId);
          if (!room) {
            room = {
              id: roomId,
              peers: new Map(),
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
          }

          // STRICT ENFORCEMENT: Max 2 users per call line!
          if (room.peers.size >= 2 && !room.peers.has(peer.id)) {
            peer.send(
              JSON.stringify({
                type: 'room-full',
                roomId,
                message: 'This direct call line is full (maximum 2 participants allowed).',
              })
            );
            return;
          }

          room.peers.set(peer.id, peer);
          peer.roomId = roomId;

          const existingPeers = Array.from(room.peers.values())
            .filter((p) => p.id !== peer.id)
            .map((p) => ({ id: p.id, displayName: p.displayName }));

          // Send confirmation to the joining peer
          peer.send(
            JSON.stringify({
              type: 'room-joined',
              roomId,
              peerId: peer.id,
              peersCount: room.peers.size,
              otherPeer: existingPeers[0] || null,
            })
          );

          // Notify other peer in the room
          if (existingPeers.length > 0) {
            broadcastToRoom(roomId, peer.id, {
              type: 'peer-joined',
              peerId: peer.id,
              displayName: peer.displayName,
              peersCount: room.peers.size,
            });
          }
          break;
        }

        case 'leave-room': {
          leaveRoom(peer);
          peer.send(JSON.stringify({ type: 'room-left' }));
          break;
        }

        // WebRTC Signaling Forwarding (offer, answer, ice-candidate, ring, decline, etc.)
        case 'offer':
        case 'answer':
        case 'ice-candidate':
        case 'call-ring':
        case 'call-accept':
        case 'call-decline':
        case 'call-hangup':
        case 'media-state':
        case 'chat-message': {
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
      console.error('Error handling WS message:', err);
    }
  });

  peer.on('close', () => {
    leaveRoom(peer);
  });

  peer.on('error', (err) => {
    console.error('WS Peer error:', err);
  });
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ice-servers', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  });
});

// Vite Integration
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
