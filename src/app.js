import express from "express";
import dotenv from "dotenv";

// Middlewares
import ApiError from "./utils/ApiError.js";
import {globalError} from "./middlewares/error.middleware.js";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";

// Routes
import { apiRateLimit } from "./middlewares/rateLimit.middleware.js";
import AuthRoutes from "./routes/auth.route.js";
import HospitalRoutes from "./routes/hospital.route.js";
import DepartmentsRoutes from "./routes/departments.route.js";
import DoctorsRoutes from "./routes/doctors.route.js";
import AdsRoutes from "./routes/ads.route.js";
import UsersRoutes from "./routes/users.route.js";
import AppointmentsRoutes from "./routes/appointments.route.js";
import DoctorDepartmentsRoutes from "./routes/doctorDepartments.route.js";
import DoctorScheduleRoutes from "./routes/doctorSchedule.route.js";
import bankAccountsRoute from "./routes/bankAccounts.route.js";
import notificationsRouter from "./routes/notifications.route.js";
import devicesRouter from "./routes/devices.route.js";
import dashboardRouter from "./routes/dashboard.route.js";

// .env configurtion
dotenv.config();

// Use Express
const app = express();

app.set("trust proxy", 1);

// Security Headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
    "http://localhost:3000",
    "https://front-j15qkf91g-abdou1001s-projects.vercel.app",
];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    }),
);

// read json
app.use(express.json());

// read form data
app.use(express.urlencoded({extended: true}));

// To put token in cookie
app.use(cookieParser());

// compressoin JSON size
app.use(compression());

// Rate Limit لجميع API
app.use("/api", apiRateLimit);
// ========== Routes ============
// Auth
app.use("/api/auth", AuthRoutes);
// Hospital
app.use("/api/hospital", HospitalRoutes);
// Departments
app.use("/api/departments", DepartmentsRoutes);
// Doctors
app.use("/api/doctors", DoctorsRoutes);
// Ads
app.use("/api/Ads", AdsRoutes);
// Users
app.use("/api/users", UsersRoutes);
// appointments
app.use("/api/appointments", AppointmentsRoutes);
// doctor-departments
app.use("/api/doctor-departments", DoctorDepartmentsRoutes);
// doctor-departments
app.use("/api/doctor-schedule", DoctorScheduleRoutes);
// bank-accounts
app.use("/api/bank-accounts", bankAccountsRoute);
// notifications
app.use("/api/notifications", notificationsRouter);
// devices
app.use("/api/devices", devicesRouter);
// dashboard
app.use("/api/dashboard", dashboardRouter);

// 404 handler
app.all("/{*any}", (req, res, next) => {
    next(new ApiError(`لا يوجد رابط بهذا الشكل! ${req.originalUrl}`, 404));
});

// error handler
app.use(globalError);

export default app;
