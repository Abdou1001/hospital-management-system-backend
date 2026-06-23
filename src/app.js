import express from "express";
import dotenv from "dotenv";

// Middlewares
import ApiError from "./utils/ApiError.js";
import { globalError } from "./middlewares/error.middleware.js";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

// Routes 
import AuthRoutes from "./routes/auth.route.js"
import HospitalRoutes from "./routes/hospital.route.js"
import DepartmentsRoutes from "./routes/departments.route.js"
import DoctorsRoutes from "./routes/doctors.route.js"
import AdsRoutes from "./routes/ads.route.js"
import UsersRoutes from "./routes/users.route.js"
import AppointmentsRoutes from "./routes/appointments.route.js"
import DoctorDepartmentsRoutes from "./routes/doctorDepartments.route.js"



// .env configurtion
dotenv.config();

// Use Express
const app = express();

// Security Headers
app.use(helmet());

// Core to send data to front end on port 5173
app.use(cors(
    {
        origin: "http://localhost:5173",
        credentials: true,
    }
));

// read json
app.use(express.json());

// read form data
app.use(express.urlencoded({ extended: true }))

// To put token in cookie
app.use(cookieParser());



// ========== Routes ============
// Auth
app.use("/api/auth", AuthRoutes)
// Hospital
app.use("/api/hospital", HospitalRoutes)
// Departments
app.use("/api/departments", DepartmentsRoutes)
// Doctors
app.use("/api/doctors", DoctorsRoutes)
// Ads
app.use("/api/Ads", AdsRoutes)
// Users
app.use("/api/users", UsersRoutes)
// appointments
app.use("/api/appointments", AppointmentsRoutes)
// appointments
app.use("/api/doctor-departments", DoctorDepartmentsRoutes)




// 404 handler
app.all('/{*any}', (req, res, next) => {
    next(new ApiError(`Can't find ${req.originalUrl}`, 404));
});


// error handler
app.use(globalError);

export default app;