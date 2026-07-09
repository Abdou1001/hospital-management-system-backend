import express from "express";
import { validate } from "../middlewares/validation.middleware.js";
import { allowedTo, protect } from "../middlewares/auth.middleware.js";
import {
    assignDoctorsSchedules,
    changeDoctorScheduleStatus,
    deleteDoctorsSchedules,
    getDoctorSchedulesInfo,
    getDoctorsSchedulesInfo,
    updateDoctorsSchedules,
} from "../controller/doctorsSchedules.controller.js";
import {
    insertDoctorScheduleSchema,
    updateDoctorScheduleSchema,
} from "../validations/doctorSchedules.validation.js";

// api/doctor-schedule/{router}

const router = express.Router();

router
    .get("/", getDoctorsSchedulesInfo)

    .post(
        "/",
        protect,
        allowedTo("admin"),
        validate(insertDoctorScheduleSchema),
        assignDoctorsSchedules,
    )

    .get("/:id", getDoctorSchedulesInfo)
    .put(
        "/:id",
        protect,
        allowedTo("admin"),
        validate(updateDoctorScheduleSchema),
        updateDoctorsSchedules,
    )
    .delete("/:id", protect, allowedTo("admin"), deleteDoctorsSchedules)

    .patch(
        "/status/:id",
        protect,
        allowedTo("admin"),
        changeDoctorScheduleStatus,
    );

export default router;
