import express from "express";
import { validate } from "../middlewares/validation.middleware.js";
import { allowedTo, protect } from "../middlewares/auth.middleware.js";
import { deleteAd, getAdsInfo, getOneAdInfo, insertAd, updateAd } from "../controller/ads.controller.js";
import { insertAdSchema, updateAdSchema } from "../validations/ads.validation.js";


// api/ads/{router}

const router = express.Router();

router
    .get("/", getAdsInfo)
    .post("/", protect, allowedTo("admin"), validate(insertAdSchema), insertAd)
    .get("/:id", getOneAdInfo)
    .put("/:id", protect, allowedTo("admin"), validate(updateAdSchema), updateAd)
    .delete("/:id", protect, allowedTo("admin"), deleteAd)



export default router;