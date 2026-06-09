import express from "express";
import { forgetPassword, login, logout, register, resetPassword, verifyPasswordResetCode } from "../controller/auth.controller.js";
import { loginSchema, registerSchema, forgotPasswordSchema, verifyPasswordResetCodeSchema, resetPasswordSchema } from "../validations/auth.validation.js";
import { validate } from "../middlewares/validation.middleware.js";
import { authRateLimit } from "../middlewares/rateLimit.middleware.js";

// api/auth/{router}

const router = express.Router();

router.post("/login",authRateLimit, validate(loginSchema), login);
router.post("/register", authRateLimit, validate(registerSchema), register);
router.post("/logout", logout);

router.post("/forget-password", authRateLimit, validate(forgotPasswordSchema), forgetPassword);
router.post("/verify-reset-code", authRateLimit, validate(verifyPasswordResetCodeSchema), verifyPasswordResetCode);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);



export default router;