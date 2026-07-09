import express from "express";
import { validate } from "../middlewares/validation.middleware.js";
import { allowedTo, protect } from "../middlewares/auth.middleware.js";
import { deleteDepartment, getDepartmentsInfo, getOneDepartmentInfo, insertDepartment, updatetDepartment } from "../controller/departments.controller.js";
import { insertDepartmentSchema, updateDepartmentSchema } from "../validations/departments.validation.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";

// api/departments/{router}

const router = express.Router();


router
    .get("/", getDepartmentsInfo)
    .post("/", protect, allowedTo("admin"),uploadSingleImage("path_image"), validate(insertDepartmentSchema), insertDepartment)
    .get("/:id", protect, allowedTo("admin"), getOneDepartmentInfo)
    .put("/:id", protect, allowedTo("admin"),uploadSingleImage("path_image"), validate(updateDepartmentSchema), updatetDepartment)
    .delete("/:id", protect, allowedTo("admin"), deleteDepartment)


export default router;