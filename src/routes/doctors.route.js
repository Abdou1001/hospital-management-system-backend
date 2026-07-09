import express from "express";
import {validate} from "../middlewares/validation.middleware.js";
import {allowedTo, protect} from "../middlewares/auth.middleware.js";
import {
    changeDoctorStatus,
    getDoctorsInfo,
    getOneDoctorInfo,
    insertDoctor,
    toggleDoctorVisibility,
    updateDoctor,
} from "../controller/doctor.controller.js";
import {
    insertDoctorSchema,
    updateDoctorSchema,
} from "../validations/doctors.validation.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";

// api/doctors/{router}

const router = express.Router();

router
    .get("/", getDoctorsInfo)
    .post(
        "/",
        protect,
        allowedTo("admin"),
        uploadSingleImage("path_image"),
        validate(insertDoctorSchema),
        insertDoctor,
    )
    .get("/:id", getOneDoctorInfo)
    .put(
        "/:id",
        protect,
        allowedTo("admin"),
        uploadSingleImage("path_image"),
        validate(updateDoctorSchema),
        updateDoctor,
    )
    .patch("/:id/status", protect, allowedTo("admin"), changeDoctorStatus)
    .patch(
        "/:id/is_hidden",
        protect,
        allowedTo("admin"),
        toggleDoctorVisibility,
    );

export default router;
