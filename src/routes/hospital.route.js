import express from "express";
import { validate } from "../middlewares/validation.middleware.js";
import { getHospitalInfo, updateHospitalInfo } from "../controller/hospital.controller.js";
import { updateHospitalInfoSchema } from "../validations/hospital.validation.js";
import { allowedTo, protect } from "../middlewares/auth.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";

// api/hospital/{router}

const router = express.Router();


router
    .get("/", getHospitalInfo)
    .put("/", protect, allowedTo("admin"),uploadSingleImage("path_image"), validate(updateHospitalInfoSchema), updateHospitalInfo)


export default router;