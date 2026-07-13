import express from "express";

import {protect, allowedTo} from "../middlewares/auth.middleware.js";

import {
    statisticsDashboard,
    appointmentsChart,
} from "../controller/dashboard.controller.js";

// api/dashboard

const router = express.Router();

router.use(protect);
router.use(allowedTo("admin"));

router.get("/statistics", statisticsDashboard);

router.get("/appointments-chart", appointmentsChart);

export default router;
