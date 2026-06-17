import express from "express";
import { validate } from "../middlewares/validation.middleware.js";
import { allowedTo, protect } from "../middlewares/auth.middleware.js";
import { cancelAppointment, changeAppointmentsStatus, createAppointment, getAppointmentsInfo, getMyAppointments, getOneAppointmentInfo, updateAppointment } from "../controller/appointments.controller.js";
import { changeAppointmentsStatusSchema, insertAppointmentSchema, updateAppointmentSchema } from "../validations/appointments.validation.js";


// api/appointments/{router}

const router = express.Router();


router
    .get("/", protect, allowedTo("admin", "reception"), getAppointmentsInfo)
    .post("/", protect, validate(insertAppointmentSchema), createAppointment)

    .get("/my-appointments", protect, getMyAppointments)

    .get("/:id", protect, allowedTo("admin", "reception"), getOneAppointmentInfo)
    .put("/:id", protect, validate(updateAppointmentSchema), updateAppointment)
    .patch("/:id/status", protect, allowedTo("admin", "reception"), validate(changeAppointmentsStatusSchema), changeAppointmentsStatus)
    .patch("/:id/cancel", protect, cancelAppointment)






export default router