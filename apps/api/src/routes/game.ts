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
    getLeaderboard,
    syncStoryEvent
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

// Phase 3: Sects (Meta Game)
import { createSect, joinSect, leaveSect, getSectInfo, getSects } from "../controllers/sectController";
router.post("/sect/create", createSect);
router.post("/sect/join", joinSect);
router.post("/sect/leave", leaveSect);
router.get("/sect/info", getSectInfo);
router.get("/sect/list", getSects);

// Phase 4: Story Events
router.post("/event/sync", syncStoryEvent);

// Phase 6: Social Protection
import { setupProtection } from "../controllers/socialController";
router.post("/social/protect", setupProtection);

// Admin / Seed
import { seedGameData } from "../controllers/gameController";
router.post("/admin/seed", seedGameData);

export default router;
