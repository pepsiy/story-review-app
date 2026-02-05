import { Router } from "express";
import { createWork, getWorks, createChapter, getWorkById, updateWork, deleteWork, updateChapter, deleteChapter, incrementWorkView } from "../controllers/adminController";

const router = Router();

// Work Routes
router.post("/works", createWork);
router.get("/works", getWorks);
router.get("/works/:id", getWorkById);
router.put("/works/:id", updateWork);
router.delete("/works/:id", deleteWork);
router.post("/works/:id/view", incrementWorkView);

// Chapter Routes
router.post("/chapters", createChapter);
router.put("/chapters/:id", updateChapter);
router.delete("/chapters/:id", deleteChapter);

// AI Routes
import { generateAIContent } from "../controllers/adminController";
router.post("/ai/generate", generateAIContent);

// URL Extraction Routes
import { extractUrlContent } from "../controllers/extractController";
router.post("/extract-url", extractUrlContent);

// Genre Routes
import { getGenres, createGenre, deleteGenre, getSettings, updateSettings } from "../controllers/adminController";
router.get("/genres", getGenres);
router.post("/genres", createGenre);
router.delete("/genres/:id", deleteGenre);

// Settings Routes
router.get("/settings", getSettings);
router.post("/settings", updateSettings);

// Game Item Routes
import { getGameItems, updateGameItem } from "../controllers/adminController";
router.get("/game-items", getGameItems);
router.post("/game-items/:id", updateGameItem); // POST for Upsert

// Stats Routes
import { getStats, getTopWorks } from "../controllers/statsController";
router.get("/stats", getStats);
router.get("/top-works", getTopWorks);

// Crawl Routes (Auto-Crawl System)
import {
    initCrawl,
    processBatch,
    getCrawlStatus,
    toggleAutoMode,
    pauseJob,
    resumeJob,
    getActiveJobs,
    testTelegramConnection,
    extractWorkInfo
} from "../controllers/crawlController";
router.post("/crawl/init", initCrawl);
router.post("/crawl/extract-info", extractWorkInfo);
router.post("/crawl/:jobId/process-batch", processBatch);
router.get("/crawl/:jobId/status", getCrawlStatus);
router.post("/crawl/:jobId/toggle-auto", toggleAutoMode);
router.post("/crawl/:jobId/pause", pauseJob);
router.post("/crawl/:jobId/resume", resumeJob);
router.get("/crawl/active", getActiveJobs);
router.post("/telegram/test", testTelegramConnection);

import { scanAndFixGaps } from "../controllers/gapController";
router.post("/crawl/scan-gaps", scanAndFixGaps);


export default router;
