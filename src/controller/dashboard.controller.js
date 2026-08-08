import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";
import {getCache, setCache} from "../services/cache.service.js";

const platform_fee_ = Number(process.env.PLATFORM_FEE);


// @Desc Get Statistics Dashboard
// @Route GET : /api/dashboard/statistics
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

    // First day of current month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const firstDay = firstDayOfMonth.toISOString();

    // Execute Queries
    const [
        {count: numberUsers, error: userError},

        {count: numberDoctors, error: doctorError},

        {count: numberDepartments, error: departmentError},

        {count: numberAds, error: adsError},

        // All appointments
        {count: numberAppointments, error: appointmentError},

        // All approved appointments
        {count: acceptedAppointments, error: acceptedError},

        // Pending appointments
        {count: pendingAppointments, error: pendingError},

        // Rejected appointments
        {count: rejectedAppointments, error: rejectedError},

        // Cancelled appointments
        {count: cancelledAppointments, error: cancelledError},

        // All appointments this month
        {
            count: appointmentsThisMonth,
            error: monthAppointmentsError,
        },

        // Approved appointments this month
        {
            count: acceptedAppointmentsThisMonth,
            error: acceptedThisMonthError,
        },
    ] = await Promise.all([
        // Users
        supabase
            .from("user")
            .select("*", {
                count: "exact",
                head: true,
            }),

        // Doctors
        supabase
            .from("doctor")
            .select("*", {
                count: "exact",
                head: true,
            }),

        // Departments
        supabase
            .from("department")
            .select("*", {
                count: "exact",
                head: true,
            }),

        // Ads
        supabase
            .from("ads")
            .select("*", {
                count: "exact",
                head: true,
            }),

        // All appointments
        supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            }),

        // Approved appointments
        supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("status", "approved"),

        // Pending appointments
        supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("status", "pending"),

        // Rejected appointments
        supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("status", "rejected"),

        // Cancelled appointments
        supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("status", "cancelled"),

        // All appointments this month
        supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .gte("created_at", firstDay),

        // Approved appointments this month
        supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("status", "approved")
            .gte("created_at", firstDay),
    ]);

    // Handle Errors
    if (userError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب عدد المستخدمين",
                500,
            ),
        );

    if (doctorError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب عدد الأطباء",
                500,
            ),
        );

    if (departmentError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب عدد الأقسام",
                500,
            ),
        );

    if (adsError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب عدد الإعلانات",
                500,
            ),
        );

    if (appointmentError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب عدد الحجوزات",
                500,
            ),
        );

    if (acceptedError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الحجوزات المقبولة",
                500,
            ),
        );

    if (pendingError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الحجوزات قيد المراجعة",
                500,
            ),
        );

    if (rejectedError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الحجوزات المرفوضة",
                500,
            ),
        );

    if (cancelledError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الحجوزات الملغية",
                500,
            ),
        );

    if (monthAppointmentsError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب حجوزات هذا الشهر",
                500,
            ),
        );

    if (acceptedThisMonthError)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الحجوزات المقبولة لهذا الشهر",
                500,
            ),
        );

    // =========================
    // Revenue
    // =========================

    // Total revenue from ALL approved appointments
    const totalRevenue =
        (acceptedAppointments || 0) * platform_fee_;

    // Monthly revenue from ONLY approved appointments this month
    const monthlyRevenue =
        (acceptedAppointmentsThisMonth || 0) * platform_fee_;

    // =========================
    // Statistics
    // =========================

    const statistics = {
        numberUsers,
        numberDoctors,
        numberDepartments,
        numberAds,

        numberAppointments,

        acceptedAppointments,
        pendingAppointments,
        rejectedAppointments,
        cancelledAppointments,

        appointmentsThisMonth,
        acceptedAppointmentsThisMonth,

        totalRevenue,
        monthlyRevenue,
    };

    // Save Redis Cache
    await setCache(
        CACHE_KEYS.DASHBOARD,
        statistics,
        CACHE_TTL.DASHBOARD,
    );

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

    // ============================
    // Check Redis Cache
    // ============================
    const cachedChart = await getCache(cacheKey);

    if (cachedChart) {
        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            year,
            ...cachedChart,
        });
    }

    // ============================
    // Get chart data
    // ============================
    const {data, error} = await supabase.rpc("get_appointments_by_month", {
        selected_year: year,
    });

    if (error)
        return next(
            new ApiError("حدث خطأ أثناء جلب بيانات الرسم البياني", 500),
        );

    // ============================
    // Calculate growth
    // ============================
    const currentMonth = new Date().getMonth() + 1;

    const currentMonthAppointments =
        data.find((item) => item.month_number === currentMonth)?.total ?? 0;

    const previousMonthAppointments =
        data.find((item) => item.month_number === currentMonth - 1)?.total ?? 0;

    let growth = 0;

    if (previousMonthAppointments > 0) {
        growth = Number(
            (
                ((currentMonthAppointments - previousMonthAppointments) /
                    previousMonthAppointments) *
                100
            ).toFixed(1),
        );
    }

    const response = {
        results: data,

        statistics: {
            currentMonthAppointments,
            previousMonthAppointments,
            growth,
        },
    };

    // ============================
    // Save Redis Cache
    // ============================
    await setCache(cacheKey, response, CACHE_TTL.DASHBOARD);

    // ============================
    // Response
    // ============================
    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        year,
        ...response,
    });
});
