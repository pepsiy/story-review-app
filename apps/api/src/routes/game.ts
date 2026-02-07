import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
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
    getLeaderboard as getBasicLeaderboard,
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
router.get("/leaderboard", getBasicLeaderboard);

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

// Phase 21: Beast Encounters (PVE)
import { getActiveEncounter, attackBeast, fleeBeast } from "../controllers/beastController";
router.post("/beast/current", getActiveEncounter);
router.post("/beast/attack", attackBeast);
router.post("/beast/flee", fleeBeast);

// Phase 22: PVP Raids
import { initiateRaid, getRaidHistory, getProtectionStatus } from "../controllers/pvpController";
router.post("/pvp/raid", initiateRaid);
router.get("/pvp/raid-history", getRaidHistory);
router.get("/pvp/protection", getProtectionStatus);

// Phase 23: Arena Combat
import { findArenaMatch, startArenaBattle, getArenaHistory } from "../controllers/arenaController";
router.post("/arena/find-match", findArenaMatch);
router.post("/arena/battle", startArenaBattle);
router.get("/arena/history", getArenaHistory);

// Phase 24: Ranking
import { getLeaderboard, getMyTier } from "../controllers/rankingController";
router.get("/ranking/leaderboard", getLeaderboard);
router.get("/ranking/my-tier", getMyTier);

// Admin / Seed
import { seedGameData } from "../controllers/gameController";
router.post("/admin/seed", seedGameData);

// Character RPG Routes
import { getCharacterProfile, distributeStatPoints, equipItem, unequipItem } from "../controllers/characterController";
import { getTrainingState, startTraining, claimTrainingRewards } from "../controllers/trainingController";

router.get('/character/profile', getCharacterProfile);
router.post('/character/stats', distributeStatPoints);
router.post('/character/equip', equipItem);
router.post('/character/unequip', unequipItem);

// Training / AFK Routes
router.get('/training', getTrainingState);
router.post('/training/start', startTraining);
router.post('/training/claim', claimTrainingRewards);

// Turn-Based Combat Routes
import { startCombat, combatAction } from "../controllers/combatController";
router.post('/combat/start', startCombat);
router.post('/combat/action', combatAction);

// Story Mode Routes
import { getStoryProgress, advanceStory } from "../controllers/storyController";
router.get('/story/progress', getStoryProgress);
router.post('/story/advance', advanceStory);

export default router;
