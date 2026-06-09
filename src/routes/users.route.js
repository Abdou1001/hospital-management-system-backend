import express from "express";
import { validate } from "../middlewares/validation.middleware.js";
import { allowedTo, protect } from "../middlewares/auth.middleware.js";
import { insertDoctorSchema, updateDoctorSchema } from "../validations/doctors.validation.js";
import { changeMyPassword, changeUserRole, changeUserStatus, getMyProfile, getOneUserInfo, getUsersInfo, updateMyProfile, updateUser } from "../controller/users.controller.js";
import { changePasswordSchema, changeUserRoleSchema, updateMyProfileSchema, updateUserSchema } from "../validations/users.validation.js";

// api/users/{router}

const router = express.Router();


router
    .get("/", protect, allowedTo("admin"), getUsersInfo)

    .get("/profile", protect, getMyProfile)
    .put("/profile", protect, validate(updateMyProfileSchema), updateMyProfile)
    .patch("/change-password", protect, validate(changePasswordSchema), changeMyPassword)

    .get("/:id", protect, allowedTo("admin"), getOneUserInfo)
    .put("/:id", protect, allowedTo("admin"),validate(updateUserSchema), updateUser)
    .patch("/:id/status", protect, allowedTo("admin"), changeUserStatus)
    .patch("/:id/role", protect, allowedTo("admin"), validate(changeUserRoleSchema), changeUserRole)





export default router;