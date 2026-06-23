import express from "express";
import { validate } from "../middlewares/validation.middleware.js";
import { allowedTo, protect } from "../middlewares/auth.middleware.js";
import { assignDoctorToDepartment, getDoctorDepartmentsInfo } from "../controller/doctorDepartments.controller.js";
import { assignDoctorToDepartmentSchema } from "../validations/doctorDepartments.validation.js";


// api/appointments/{router}

const router = express.Router();


router
    .get("/", protect, allowedTo("admin"), getDoctorDepartmentsInfo)
    .post("/", protect, allowedTo("admin"), validate(assignDoctorToDepartmentSchema), assignDoctorToDepartment)






export default router