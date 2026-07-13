import express from "express";

import {protect, allowedTo} from "../middlewares/auth.middleware.js";

import {
    StatisticsDashboard,
    AppointmentsChart,
} from "../controller/dashboard.controller.js";

// api/dashboard

const router = express.Router();

router.use(protect);
router.use(allowedTo("admin"));

router.get("/statistics", StatisticsDashboard);

router.get("/appointments-chart", AppointmentsChart);

export default router;
