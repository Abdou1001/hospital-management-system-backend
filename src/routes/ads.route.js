import express from "express";
import {validate} from "../middlewares/validation.middleware.js";
import {allowedTo, protect} from "../middlewares/auth.middleware.js";
import {
    deleteAd,
    getAdsInfo,
    getOneAdInfo,
    insertAd,
    toggleAdStatus,
    updateAd,
} from "../controller/ads.controller.js";
import {insertAdSchema, updateAdSchema} from "../validations/ads.validation.js";
import {uploadSingleImage} from "../middlewares/upload.middleware.js";

// api/ads/{router}

const router = express.Router();

router
    .get("/", getAdsInfo)
    .post(
        "/",
        protect,
        allowedTo("admin"),
        uploadSingleImage("path_image"),
        validate(insertAdSchema),
        insertAd,
    )
    .get("/:id", getOneAdInfo)
    .put(
        "/:id",
        protect,
        allowedTo("admin"),
        uploadSingleImage("path_image"),
        validate(updateAdSchema),
        updateAd,
    )
    .delete("/:id", protect, allowedTo("admin"), deleteAd)
    .patch("/:id/status", protect, allowedTo("admin"), toggleAdStatus);

export default router;
