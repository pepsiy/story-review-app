import { Router } from "express";
import { getGameState, plantSeed, harvestPlant, buyItem, sellItem, craftItem, useItem } from "../controllers/gameController";

const router = Router();

router.post("/state", getGameState);
router.post("/plant", plantSeed);
router.post("/harvest", harvestPlant);
router.post("/buy", buyItem);
router.post("/sell", sellItem);
router.post("/craft", craftItem);
router.post("/use", useItem);

export default router;
