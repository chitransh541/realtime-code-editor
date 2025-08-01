import express from 'express';
import http from 'http';
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

// Map<roomId, Set<userNames>>
const rooms = new Map();

io.on("connection", (socket) => {
    console.log("User Connected", socket.id);

    // Store user-specific info on the socket object
    socket.currentRoom = null;
    socket.userName = null;

    // Join a room
    socket.on("join", ({ roomId, userName }) => {
        // Leave old room if applicable
        if (socket.currentRoom && rooms.has(socket.currentRoom)) {
            rooms.get(socket.currentRoom).delete(socket.userName);
            io.to(socket.currentRoom).emit("userJoined", Array.from(rooms.get(socket.currentRoom)));
            socket.leave(socket.currentRoom);

            // Delete room if empty
            if (rooms.get(socket.currentRoom).size === 0) {
                rooms.delete(socket.currentRoom);
            }
        }

        // Update socket info
        socket.currentRoom = roomId;
        socket.userName = userName;

        // Join new room
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }

        rooms.get(roomId).add(userName);

        // Notify all clients in room
        io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));

        console.log(`User ${userName} joined room ${roomId}`);
    });

    // Handle code change
    socket.on("codeChange", ({ roomId, code }) => {
        socket.to(roomId).emit("codeUpdate", code);
    });

    // Handle typing indication
    socket.on("typing", ({ roomId, userName }) => {
        socket.to(roomId).emit("userTyping", userName);
    });
    socket.on("languageChange",({roomId,language})=>{
        io.to(roomId).emit("languageUpdate",language);  
    })

    // Manual room leave
    socket.on("leaveRoom", () => {
        const roomId = socket.currentRoom;
        const userName = socket.userName;

        if (roomId && rooms.has(roomId)) {
            rooms.get(roomId).delete(userName);
            io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
            socket.leave(roomId);

            // Delete room if empty
            if (rooms.get(roomId).size === 0) {
                rooms.delete(roomId);
            }
        }

        // Clear socket info
        socket.currentRoom = null;
        socket.userName = null;

        console.log(`User ${userName} left room ${roomId}`);
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
        const roomId = socket.currentRoom;
        const userName = socket.userName;

        if (roomId && rooms.has(roomId)) {
            rooms.get(roomId).delete(userName);
            io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));

            // Delete room if empty
            if (rooms.get(roomId).size === 0) {
                rooms.delete(roomId);
            }
        }

        console.log("User Disconnected", socket.id);
    });
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
    console.log('Server is working on port', port);
});
