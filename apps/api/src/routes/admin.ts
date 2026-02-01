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

// Genre Routes
import { getGenres, createGenre, deleteGenre, getSettings, updateSettings } from "../controllers/adminController";
router.get("/genres", getGenres);
router.post("/genres", createGenre);
router.delete("/genres/:id", deleteGenre);

// Settings Routes
router.get("/settings", getSettings);
router.post("/settings", updateSettings);

export default router;
