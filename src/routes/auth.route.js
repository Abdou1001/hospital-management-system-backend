import express from "express";
import {
    changePhoneNumber,
    forgetPassword,
    getMe,
    login,
    logout,
    register,
    resendChangePhoneOTP,
    resendOTP,
    resetPassword,
    verifyChangePhoneNumber,
    verifyPasswordResetCode,
    verifyPhoneOTP,
} from "../controller/auth.controller.js";
import {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    verifyPasswordResetCodeSchema,
    resetPasswordSchema,
    verifyPhoneOTPSchema,
    changePhoneNumberSchema,
    verifyChangePhoneNumberSchema,
} from "../validations/auth.validation.js";
import {validate} from "../middlewares/validation.middleware.js";
import {
    authRateLimit,
    otpRateLimit,
} from "../middlewares/rateLimit.middleware.js";
import {protect} from "../middlewares/auth.middleware.js";

// api/auth/{router}

const router = express.Router();

// Login
router.post("/login", validate(loginSchema), login);

// Register
router.post("/register", authRateLimit, validate(registerSchema), register);

// Verify Phone
router.post(
    "/verify-phone",
    authRateLimit,
    validate(verifyPhoneOTPSchema),
    verifyPhoneOTP,
);

// Resend OTP
router.post("/resend-otp", otpRateLimit, resendOTP);

// Logout
router.post("/logout", logout);

router.get("/me", protect, getMe);

// Change Phone Number
router.post(
    "/change-phone",
    protect,
    authRateLimit,
    validate(changePhoneNumberSchema),
    changePhoneNumber,
);

router.post(
    "/verify-change-phone",
    protect,
    authRateLimit,
    validate(verifyChangePhoneNumberSchema),
    verifyChangePhoneNumber,
);

router.post(
    "/resend-change-phone-otp",
    protect,
    otpRateLimit,
    resendChangePhoneOTP,
);

// Forget Password
router.post(
    "/forget-password",
    otpRateLimit,
    validate(forgotPasswordSchema),
    forgetPassword,
);

router.post(
    "/verify-reset-code",
    authRateLimit,
    validate(verifyPasswordResetCodeSchema),
    verifyPasswordResetCode,
);

router.post(
    "/reset-password",
    authRateLimit,
    validate(resetPasswordSchema),
    resetPassword,
);
export default router;
