import { Server } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> | null = null;

export const initSocket = (serverInstance: Server) => {
    io = serverInstance;
    console.log("✅ Socket.IO Service Initialized");
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.IO not initialized!");
    }
    return io;
};

// Safe emit that doesn't crash if IO not ready
export const emitLog = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info', jobId?: number) => {
    if (io) {
        io.emit("crawl_log", {
            message,
            type,
            jobId,
            timestamp: new Date().toISOString()
        });
    }
};
