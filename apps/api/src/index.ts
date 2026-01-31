import "dotenv/config";
import express from "express";
import cors from "cors";
import adminRoutes from "./routes/admin";

import http from "http";
import { Server } from "socket.io";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Create HTTP Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  // console.log("User connected:", socket.id, "UserID:", userId);

  socket.on("join_community", () => {
    socket.join("community");
    // Could emit 'user_joined'
  });

  socket.on("send_message", (data) => {
    // Broadcast immediately
    io.to("community").emit("receive_message", {
      ...data,
      id: Date.now(), // Temp ID
      createdAt: new Date().toISOString(),
    });

    // Persist to DB logic can go here (async)
  });

  socket.on("disconnect", () => {
    // console.log("User disconnected");
  });
});


// Routes
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("Story Review API is running (Admin Routes & Socket.io Available)!");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

server.listen(port, () => {
  console.log(`Server running on port ${port} (Socket.io ready)`);
  console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
});
