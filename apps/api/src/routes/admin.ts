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
    extractWorkInfo,
    repairJob,
    updateJobConfig,
    getLatestJobForWork
} from "../controllers/crawlController";
router.post("/crawl/init", initCrawl);
router.post("/crawl/extract-info", extractWorkInfo);
router.post("/crawl/:jobId/process-batch", processBatch);
router.get("/crawl/:jobId/status", getCrawlStatus);
router.post("/crawl/:jobId/toggle-auto", toggleAutoMode);
router.post("/crawl/:jobId/repair", repairJob);
router.post("/crawl/:jobId/update-config", updateJobConfig); // NEW Config Route
router.post("/crawl/:jobId/pause", pauseJob);
router.post("/crawl/:jobId/resume", resumeJob);
router.get("/crawl/active", getActiveJobs);
router.get("/crawl/work/:workId", getLatestJobForWork); // NEW: Get latest job (even completed)
router.post("/telegram/test", testTelegramConnection);

import { scanAndFixGaps, fixRange, retryChapter } from "../controllers/gapController";
router.post("/crawl/scan-gaps", scanAndFixGaps);
router.post("/crawl/fix-range", fixRange);
router.post("/crawl/retry-chapter", retryChapter);

// Mission Management Routes (Admin)
import { getAllMissionsAdmin, createMission, updateMission, deleteMission } from "../controllers/missionController";
router.get("/missions", getAllMissionsAdmin);
router.post("/missions", createMission);
router.put("/missions/:id", updateMission);
router.delete("/missions/:id", deleteMission);

export default router;
