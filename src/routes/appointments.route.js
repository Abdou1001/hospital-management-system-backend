import express from "express";
import {validate} from "../middlewares/validation.middleware.js";
import {allowedTo, protect} from "../middlewares/auth.middleware.js";
import {
    cancelAppointment,
    changeAppointmentsStatus,
    createAppointment,
    getAppointmentsInfo,
    getMyAppointments,
    getOneAppointmentInfo,
    updateAppointment,
} from "../controller/appointments.controller.js";
import {
    changeAppointmentsStatusSchema,
    insertAppointmentSchema,
    updateAppointmentSchema,
} from "../validations/appointments.validation.js";
import {uploadSingleImage} from "../middlewares/upload.middleware.js";

// api/appointments/{router}

const router = express.Router();

router
    .get("/", protect, allowedTo("admin", "reception"), getAppointmentsInfo)
    .post(
        "/",
        protect,
        uploadSingleImage("payment_receipt"),
        validate(insertAppointmentSchema),
        createAppointment,
    )

    .get("/my-appointments", protect, getMyAppointments)

    .get(
        "/:id",
        protect,
        allowedTo("admin", "reception"),
        getOneAppointmentInfo,
    )
    .put(
        "/:id",
        protect,
        uploadSingleImage("payment_receipt"),
        validate(updateAppointmentSchema),
        updateAppointment,
    )
    .patch(
        "/:id/status",
        protect,
        allowedTo("admin", "reception"),
        validate(changeAppointmentsStatusSchema),
        changeAppointmentsStatus,
    )
    .patch("/:id/cancel", protect, cancelAppointment);

export default router;
