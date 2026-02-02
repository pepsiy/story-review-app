import { Router } from "express";
import { getGameState, plantSeed, harvestPlant, buyItem } from "../controllers/gameController";

const router = Router();

router.post("/state", getGameState);
router.post("/plant", plantSeed);
router.post("/harvest", harvestPlant);
router.post("/buy", buyItem);

export default router;
