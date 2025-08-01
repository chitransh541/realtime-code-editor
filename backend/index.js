// backend/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Store room data
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User Connected', socket.id);

  socket.currentRoom = null;
  socket.userName = null;

  socket.on('join', ({ roomId, userName }) => {
    if (socket.currentRoom && rooms.has(socket.currentRoom)) {
      rooms.get(socket.currentRoom).delete(socket.userName);
      io.to(socket.currentRoom).emit(
        'userJoined',
        Array.from(rooms.get(socket.currentRoom))
      );
      socket.leave(socket.currentRoom);
      if (rooms.get(socket.currentRoom).size === 0) {
        rooms.delete(socket.currentRoom);
      }
    }

    socket.currentRoom = roomId;
    socket.userName = userName;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);
    io.to(roomId).emit('userJoined', Array.from(rooms.get(roomId)));

    console.log(`User ${userName} joined room ${roomId}`);
  });

  socket.on('codeChange', ({ roomId, code }) => {
    socket.to(roomId).emit('codeUpdate', code);
  });

  socket.on('typing', ({ roomId, userName }) => {
    socket.to(roomId).emit('userTyping', userName);
  });

  socket.on('languageChange', ({ roomId, language }) => {
    io.to(roomId).emit('languageUpdate', language);
  });

  socket.on('leaveRoom', () => {
    const { currentRoom, userName } = socket;

    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(userName);
      io.to(currentRoom).emit('userJoined', Array.from(rooms.get(currentRoom)));
      socket.leave(currentRoom);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }

    socket.currentRoom = null;
    socket.userName = null;
    console.log(`User ${userName} left room ${currentRoom}`);
  });

  socket.on('disconnect', () => {
    const { currentRoom, userName } = socket;

    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(userName);
      io.to(currentRoom).emit('userJoined', Array.from(rooms.get(currentRoom)));
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }

    console.log('User Disconnected', socket.id);
  });
});

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log('Server is working on port', port);
});
