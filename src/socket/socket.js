const { Server } = require("socket.io");

let io;
const users = new Map(); // Maps userId -> socketId

module.exports = {
  init: (server) => {
    io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "https://cooli-frontends.vercel.app"
        ],
        methods: ["GET", "POST"]
      }
    });

    io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on("register", (userId) => {
        users.set(userId, socket.id);
        console.log(`User registered: ${userId} with socket: ${socket.id}`);
      });

      socket.on("joinConversation", (conversationId) => {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined room (conversation): ${conversationId}`);
      });

      socket.on("leaveConversation", (conversationId) => {
        socket.leave(conversationId);
        console.log(`Socket ${socket.id} left room (conversation): ${conversationId}`);
      });

      socket.on("sendMessage", (message) => {
        // When client sends directly via socket (optional architecture, currently using REST for send and socket for emit)
        io.to(message.conversationId).emit("receiveMessage", message);
      });

      socket.on("typing", ({ conversationId, senderId }) => {
        socket.to(conversationId).emit("userTyping", { conversationId, senderId });
      });

      socket.on("stopTyping", ({ conversationId, senderId }) => {
        socket.to(conversationId).emit("userStoppedTyping", { conversationId, senderId });
      });

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
        // Remove user from map
        for (let [userId, socketId] of users.entries()) {
          if (socketId === socket.id) {
            users.delete(userId);
            break;
          }
        }
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }
    return io;
  },
  getUsers: () => users
};
