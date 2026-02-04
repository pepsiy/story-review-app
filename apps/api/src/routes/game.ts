import { Router } from "express";
import {
    getGameState,
    plantSeed,
    harvestPlant,
    buyItem,
    sellItem,
    craftItem,
    useItem,
    unlockSlot,
    waterPlant,
    getLogs,
    attemptBreakthrough,
    getLeaderboard
} from "../controllers/gameController";

import { getMissions, acceptMission, completeMission } from "../controllers/missionController";
import { getOtherUserFarm, stealHarvest } from "../controllers/socialController";

const router = Router();

// Game State
router.post("/state", getGameState);

// Actions
router.post("/plant", plantSeed);
router.post("/harvest", harvestPlant);
router.post("/buy", buyItem);
router.post("/sell", sellItem);
router.post("/craft", craftItem);
router.post("/use", useItem);

// Phase 1: Core & Social
router.post("/unlock-slot", unlockSlot);
router.post("/water", waterPlant); // Use gameController's waterPlant logic
router.get("/logs", getLogs);

// Phase 2: Retention (Breakthrough & Leaderboard)
router.post("/breakthrough", attemptBreakthrough);
router.get("/leaderboard", getLeaderboard);

// Mission Routes
router.post("/missions", getMissions);
router.post("/missions/accept", acceptMission);
router.post("/missions/complete", completeMission);

// Social Extended Routes
router.post("/visit-farm", getOtherUserFarm);
router.post("/steal", stealHarvest);

export default router;
