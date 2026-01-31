import { Router } from "express";
import { createWork, getWorks, createChapter, getWorkById, updateWork, deleteWork, updateChapter, deleteChapter } from "../controllers/adminController";

const router = Router();

// Work Routes
router.post("/works", createWork);
router.get("/works", getWorks);
router.get("/works/:id", getWorkById);
router.put("/works/:id", updateWork);
router.delete("/works/:id", deleteWork);

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

export default router;
