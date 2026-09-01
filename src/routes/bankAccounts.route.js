import express from "express";

import {
    getBankAccountsInfo,
    getOneBankAccountInfo,
    insertBankAccount,
    updateBankAccount,
    toggleBankAccountStatus,
    deleteBankAccount,
} from "../controller/bankAccounts.controller.js";

import {protect, allowedTo} from "../middlewares/auth.middleware.js";

import {uploadSingleImage} from "../middlewares/upload.middleware.js";

const router = express.Router();

// Public
router.get("/", getBankAccountsInfo);

// Admin
router.get("/:id", protect, allowedTo("admin"), getOneBankAccountInfo);

router.post(
    "/",
    protect,
    allowedTo("admin"),
    uploadSingleImage("path_image"),
    insertBankAccount,
);

router.put(
    "/:id",
    protect,
    allowedTo("admin"),
    uploadSingleImage("path_image"),
    updateBankAccount,
);

router.patch(
    "/:id/status",
    protect,
    allowedTo("admin"),
    toggleBankAccountStatus,
);

router.delete("/:id", protect, allowedTo("admin"), deleteBankAccount);

export default router;
