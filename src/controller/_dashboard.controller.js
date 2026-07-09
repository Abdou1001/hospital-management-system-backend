import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";

// @Desc Get Statistics Dashboard (Number of Users, Number of Doctors, Number of Deparments
//  Number of Ads, Number of Appointments)
// @Route GET : /api/ads
// @Access Private (Admin)
export const StatisticsDashboard = AsyncHandler(async (req, res, next) => {
    // Number of Users
    const {
        data: user,
        error: userError,
        count: numberUsers,
    } = supabase.from("user").select("user_id", {count: "exact"});

    if (!user || error)
        return next(new ApiError("حدث خطاء اثناء جلب المستخدمين"));

    // Number of Doctors
    const {
        data: doctor,
        error: doctorError,
        count: numberDoctors,
    } = supabase.from("doctor").select("doctor_id", {count: "exact"});

    if (!doctor || doctorError)
        return next(new ApiError("حدث خطاء اثناء جلب المستخدمين"));

    // Number of departments
    const {
        data: department,
        error: departmentError,
        count: numberDepartments,
    } = supabase.from("department").select("depart_id", {count: "exact"});

    if (!department || departmentError)
        return next(new ApiError("حدث خطاء اثناء جلب الاقسام"));

    // Number of Ads
    const {
        data: ads,
        error: adsError,
        count: numberAds,
    } = supabase.from("ads").select("ads_id", {count: "exact"});

    if (!ads || adsError)
        return next(new ApiError("حدث خطاء اثناء جلب الاعلانات"));

    // Number of Appointments
    const {
        data: appointment,
        error: appointmentError,
        count: numberAppointments,
    } = supabase.from("appointment").select("appointment_id", {count: "exact"});

    if (!appointment || appointmentError)
        return next(new ApiError("حدث خطاء اثناء جلب الحجوزات"));

    res.status(200).json({
        status: "",
        message: "تم جلب البيانات بنجاح",
        results: {
            numberUsers,
            numberDepartments,
            numberDoctors,
            numberAds,
            numberAppointments,
        },
    });
});
