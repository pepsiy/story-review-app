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

// Public Routes
import { getGenres } from "./controllers/adminController";
app.get("/genres", getGenres);

// Create HTTP Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  }
});

// Initialize Socket Service
import { initSocket } from "./services/socketService";
initSocket(io);

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

import gameRoutes from "./routes/game";
app.use("/game", gameRoutes);

app.get("/", (req, res) => {
  res.send("Story Review API is running (Admin Routes & Socket.io Available)!");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize services
import { telegramService } from "./services/telegramService";
import { startCrawlCron } from "./services/crawlCron";
import { startGoogleSheetsWorker } from "./services/googleSheetsSync";

async function initializeServices() {
  console.log("🔧 Initializing services...");

  // Initialize Telegram bot
  await telegramService.initialize();

  // Start cron job for auto-crawl
  startCrawlCron();

  // Start Background Sync Worker for Google Sheets HA Fallback
  startGoogleSheetsWorker();

  console.log("✅ All services initialized");
}

server.listen(port, async () => {
  console.log(`Server running on port ${port} (Socket.io ready)`);
  console.log(`Last updated: ${new Date().toLocaleTimeString()}`);

  // Initialize services after server starts
  await initializeServices();
});
