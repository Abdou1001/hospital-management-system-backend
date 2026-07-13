import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";
import {getCache, setCache} from "../services/cache.service.js";

// @Desc Get Statistics Dashboard (Number of Users, Number of Doctors, Number of Deparments
//  Number of Ads, Number of Appointments)
// @Route GET : /api/ads
// @Access Private (Admin)
export const statisticsDashboard = AsyncHandler(async (req, res, next) => {
    // Check Redis Cache
    const cachedStatistics = await getCache(CACHE_KEYS.DASHBOARD);

    if (cachedStatistics) {
        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedStatistics,
        });
    }

    // Execute Queries
    const [
        {count: numberUsers, error: userError},
        {count: numberDoctors, error: doctorError},
        {count: numberDepartments, error: departmentError},
        {count: numberAds, error: adsError},
        {count: numberAppointments, error: appointmentError},
    ] = await Promise.all([
        supabase.from("user").select("*", {count: "exact", head: true}),

        supabase.from("doctor").select("*", {count: "exact", head: true}),

        supabase.from("department").select("*", {count: "exact", head: true}),

        supabase.from("ads").select("*", {count: "exact", head: true}),

        supabase.from("appointment").select("*", {count: "exact", head: true}),
    ]);

    // Handle Errors
    if (userError)
        return next(new ApiError("حدث خطأ أثناء جلب عدد المستخدمين", 500));

    if (doctorError)
        return next(new ApiError("حدث خطأ أثناء جلب عدد الأطباء", 500));

    if (departmentError)
        return next(new ApiError("حدث خطأ أثناء جلب عدد الأقسام", 500));

    if (adsError)
        return next(new ApiError("حدث خطأ أثناء جلب عدد الإعلانات", 500));

    if (appointmentError)
        return next(new ApiError("حدث خطأ أثناء جلب عدد الحجوزات", 500));

    const statistics = {
        numberUsers,
        numberDoctors,
        numberDepartments,
        numberAds,
        numberAppointments,
    };

    // Save Redis Cache
    await setCache(CACHE_KEYS.DASHBOARD, statistics, CACHE_TTL.DASHBOARD);

    // Response
    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        results: statistics,
    });
});

export const appointmentsChart = AsyncHandler(async (req, res, next) => {
    const year = Number(req.query.year) || new Date().getFullYear();

    const cacheKey = `${CACHE_KEYS.APPOINTMENTS_CHART}:${year}`;

    // Check Redis Cache
    const cachedChart = await getCache(cacheKey);

    if (cachedChart) {
        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedChart,
        });
    }

    // Execute SQL Function
    const {data, error} = await supabase.rpc("get_appointments_by_month", {
        selected_year: year,
    });

    if (error)
        return next(
            new ApiError("حدث خطأ أثناء جلب بيانات الرسم البياني", 500),
        );

    // Save Cache
    await setCache(cacheKey, data, CACHE_TTL.DASHBOARD);

    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        year,
        results: data,
    });
});