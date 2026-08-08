import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
import {getPublicImageUrl} from "../services/storage.service.js";
import {STORAGE_BUCKETS} from "../config/storage.js";
import {
    deleteByPattern,
    deleteCache,
    getCache,
    setCache,
} from "../services/cache.service.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";

    // ترتيب أيام الأسبوع
const daysOrder = {
    "السبت": 1,
    "الاحد": 2,
    "الاثنين": 3,
    "الثلاثاء": 4,
    "الاربعاء": 5,
    "الخميس": 6,
    "الجمعة": 7,
};

// @Desc Get all Doctors Schedules Info
// @Route GET : /api/doctor-schedule
// Examples:
// GET /api/doctor-schedules?
// keyword=احمد
// &doctor_id=5
// &day_of_week=الاحد
// &shift_type=الصباح
// &status=active
// &sort=start_time
// &page=1
// &limit=10
// @Access public
export const getDoctorsSchedulesInfo = AsyncHandler(async (req, res, next) => {
    const {
        doctor_id,
        shift_type,
        status,
        start_time,
        end_time,
        keyword = "",
    } = req.query;

    // Pagination
    const {page, limit, from, to} = paginate(req);

    // Cache Key
    const cacheKey = `doctor-schedules:page=${page}:limit=${limit}:doctor=${doctor_id || "all"}:keyword=${keyword}:shift=${shift_type || "all"}:status=${status || "all"}:start=${start_time || "all"}:end=${end_time || "all"}`;

    // Check Redis Cache
    const cachedSchedules = await getCache(cacheKey);

    if (cachedSchedules) {
        cachedSchedules.results.forEach((schedule) => {
            schedule.doctor.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                schedule.doctor.path_image,
            );
        });

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            pagination: cachedSchedules.pagination,
            results: cachedSchedules.results,
            count: cachedSchedules.count,
        });
    }

    let query = supabase.from("doctor_schedule").select("*, doctor (*)", {
        count: "exact",
    });

    // Search by doctor name
    if (keyword) {
        const {data: doctors} = await supabase
            .from("doctor")
            .select("doctor_id")
            .ilike("full_name", `%${keyword}%`);

        const doctorIds = doctors?.map((doctor) => doctor.doctor_id) || [];

        if (doctorIds.length === 0) {
            const pagination = paginationResult(page, limit, 0);

            await setCache(
                cacheKey,
                {
                    pagination,
                    results: [],
                    count: 0,
                },
                CACHE_TTL.DOCTOR_SCHEDULES,
            );

            return res.status(200).json({
                status: "success",
                message: "تم جلب البيانات بنجاح",
                pagination,
                results: [],
                count: 0,
            });
        }

        query = query.in("doctor_id", doctorIds);
    }

    // Filter by Doctor id
    if (doctor_id) query = query.eq("doctor_id", doctor_id);

    // Filter by shift type
    if (shift_type) query = query.eq("shift_type", shift_type);

    // Filter by Status
    if (status) query = query.eq("status", status);

    // Filter by start time
    if (start_time) query = query.gte("start_time", start_time);

    // Filter by end time
    if (end_time) query = query.lte("end_time", end_time);

    // Execute Query
    const {data, error, count} = await query.range(from, to);

    if (!data || error)
        return next(new ApiError("حدث خطأ أثناء جلب الأوقات", 500));

    // ترتيب النتائج حسب أيام الأسبوع ثم وقت البداية
    data.sort((a, b) => {
        const dayCompare =
            daysOrder[a.day_of_week] - daysOrder[b.day_of_week];

        if (dayCompare !== 0) {
            return dayCompare;
        }

        return a.start_time.localeCompare(b.start_time);
    });

    const pagination = paginationResult(page, limit, count);

    // Save Cache
    await setCache(
        cacheKey,
        {
            pagination,
            results: data,
            count,
        },
        CACHE_TTL.DOCTOR_SCHEDULES,
    );

    // Replace image path with public url
    data.forEach((schedule) => {
        schedule.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            schedule.doctor.path_image,
        );
    });

    // Response
    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        pagination,
        results: data,
        count,
    });
});

// @Desc Get Doctor Schedule Info
// @Route GET : /api/doctor-schedule/:id
// @Access public
export const getDoctorSchedulesInfo = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const cacheKey = CACHE_KEYS.DOCTOR_SCHEDULE(id);

    const cachedSchedules = await getCache(cacheKey);

    if (cachedSchedules) {
        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedSchedules,
        });
    }

    const {data: schedules, error} = await supabase
        .from("doctor_schedule")
        .select("*")
        .eq("doctor_id", id);

    if (error)
        return next(
            new ApiError("حدث خطأ أثناء جلب أوقات دوام الطبيب", 500),
        );

    // ترتيب أيام الأسبوع ثم وقت البداية
    schedules.sort((a, b) => {
        const dayCompare =
            daysOrder[a.day_of_week] - daysOrder[b.day_of_week];

        if (dayCompare !== 0) {
            return dayCompare;
        }

        return a.start_time.localeCompare(b.start_time);
    });

    await setCache(cacheKey, schedules, CACHE_TTL.DOCTOR_SCHEDULE);

    return res.status(200).json({
        status: "success",
        message: schedules.length
            ? "تم جلب أوقات دوام الطبيب بنجاح"
            : "لا توجد أوقات دوام لهذا الطبيب",
        results: schedules,
    });
});

// @Desc Assign Doctor to Schedule
// @Route POST : /api/doctor-schedules
// @Access Private (Admin)
export const assignDoctorsSchedules = AsyncHandler(async (req, res, next) => {
    const {
        day_of_week,
        shift_type,
        start_time,
        end_time,
        doctor_id,
        notes = "",
        max_patients,
        status,
    } = req.body;

    /* ==========================================
        Check if doctor exists
    ========================================== */
    const {data: doctor, error: doctorError} = await supabase
        .from("doctor")
        .select("doctor_id,status,is_hidden,path_image")
        .eq("doctor_id", doctor_id)
        .single();

    if (!doctor || doctorError)
        return next(new ApiError("الطبيب غير موجود، حاول مرة اخرى", 404));

    if (doctor.is_hidden)
        return next(new ApiError("الطبيب غير متاح", 400));

    if (doctor.status !== "active")
        return next(new ApiError("الطبيب غير مفعل", 400));

    /* ==========================================
        Validate Status
    ========================================== */
    if (status && !["active", "inactive"].includes(status))
        return next(new ApiError("حالة الدوام غير صالحة", 400));

    /* ==========================================
        Check duplicate schedule
    ========================================== */
    const {data: existingSchedule} = await supabase
        .from("doctor_schedule")
        .select("schedule_id")
        .eq("doctor_id", doctor_id)
        .eq("day_of_week", day_of_week)
        .eq("start_time", start_time)
        .eq("end_time", end_time)
        .maybeSingle();

    if (existingSchedule)
        return next(
            new ApiError("يوجد دوام بنفس البيانات لهذا الطبيب", 400),
        );

    /* ==========================================
        Create schedule
    ========================================== */
    const {data: assign, error} = await supabase
        .from("doctor_schedule")
        .insert({
            day_of_week,
            shift_type,
            start_time,
            end_time,
            doctor_id,
            notes,
            max_patients,
            status: status ?? "active",
        })
        .select("*, doctor(*)")
        .single();

    if (!assign || error)
        return next(
            new ApiError("حدث خطأ أثناء إضافة دوام الطبيب، حاول مرة اخرى", 400),
        );

    /* ==========================================
        Clear Cache
    ========================================== */
    await deleteByPattern("doctor-schedules:*");
    await deleteCache(CACHE_KEYS.DOCTOR_SCHEDULE(doctor_id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

    /* ==========================================
        Convert Image
    ========================================== */
    assign.doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        assign.doctor.path_image,
    );

    /* ==========================================
        Response
    ========================================== */
    res.status(201).json({
        status: "success",
        message: "تم إضافة دوام الطبيب بنجاح",
        results: assign,
    });
});

// @Desc Update Doctor Schedule
// @Route PUT : /api/doctor-schedule/:id
// @Access Private (Admin)
export const updateDoctorsSchedules = AsyncHandler(async (req, res, next) => {
    const {
        day_of_week,
        shift_type,
        start_time,
        end_time,
        doctor_id,
        notes = "",
        max_patients,
        status,
    } = req.body;

    const {id} = req.params;

    /* ==========================================
        Check schedule exists
    ========================================== */
    const {data: schedule, error: scheduleError} = await supabase
        .from("doctor_schedule")
        .select("*")
        .eq("schedule_id", id)
        .single();

    if (!schedule || scheduleError)
        return next(new ApiError("الدوام غير موجود، حاول مرة اخرى", 404));

    /* ==========================================
        Check doctor exists
    ========================================== */
    const {data: doctor, error: doctorError} = await supabase
        .from("doctor")
        .select("doctor_id,status,is_hidden,path_image")
        .eq("doctor_id", doctor_id)
        .single();

    if (!doctor || doctorError)
        return next(new ApiError("الطبيب غير موجود، حاول مرة اخرى", 404));

    if (doctor.is_hidden)
        return next(new ApiError("الطبيب غير متاح", 400));

    if (doctor.status !== "active")
        return next(new ApiError("الطبيب غير مفعل", 400));

    /* ==========================================
        Check duplicate only if schedule changed
    ========================================== */
    const isChanged =
        schedule.day_of_week !== day_of_week ||
        schedule.shift_type !== shift_type ||
        schedule.start_time !== start_time ||
        schedule.end_time !== end_time ||
        schedule.max_patients !== max_patients ||
        schedule.status !== status ||
        (schedule.notes ?? "") !== (notes ?? "");

    if (isChanged) {
        const {data: existingSchedule} = await supabase
            .from("doctor_schedule")
            .select("schedule_id")
            .eq("doctor_id", doctor_id)
            .eq("day_of_week", day_of_week)
            .eq("start_time", start_time)
            .eq("end_time", end_time)
            .neq("schedule_id", id)
            .maybeSingle();

        if (existingSchedule)
            return next(
                new ApiError("يوجد دوام بنفس البيانات لهذا الطبيب", 400),
            );
    }

    /* ==========================================
        Update schedule
    ========================================== */
    const {data: update, error} = await supabase
        .from("doctor_schedule")
        .update({
            day_of_week,
            shift_type,
            start_time,
            end_time,
            doctor_id,
            notes,
            max_patients,
            status,
        })
        .eq("schedule_id", id)
        .select("*, doctor(*)")
        .single();

    if (!update || error)
        return next(
            new ApiError("حدث خطأ أثناء تعديل الدوام، حاول مرة اخرى", 400),
        );

    /* ==========================================
        Clear Cache
    ========================================== */
    await deleteByPattern("doctor-schedules:*");
    await deleteCache(CACHE_KEYS.DOCTOR_SCHEDULE(update.doctor_id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

    /* ==========================================
        Convert image path
    ========================================== */
    update.doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        update.doctor.path_image,
    );

    /* ==========================================
        Response
    ========================================== */
    res.status(200).json({
        status: "success",
        message: "تم تحديث الدوام بنجاح",
        results: update,
    });
});

// @Desc Delete Doctor to Schedule
// @Route DELETE : /api/doctor-schedule
// @Access Private (Admin)
export const deleteDoctorsSchedules = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    // Check of Id (Schedule) this exist
    const {data: schedule, error: scheduleError} = await supabase
        .from("doctor_schedule")
        .select("schedule_id")
        .eq("schedule_id", id)
        .single();

    if (!schedule || scheduleError)
        return next(new ApiError("الدوام غير موجود، حاول مرة اخرى", 404));

    const {count} = await supabase
        .from("appointment")
        .select("*", {
            count: "exact",
            head: true,
        })
        .eq("schedule_id", id);

    if (count > 0)
        return next(
            new ApiError(
                "لا يمكن حذف هذا الدوام لوجود حجوزات مرتبطة به، يمكنك إيقافه بدلاً من حذفه.",
                400,
            ),
        );

    // Delete the schedule
    const {data: deleteSchdule, error} = await supabase
        .from("doctor_schedule")
        .delete()
        .eq("schedule_id", id)
        .select("*");

    if (!deleteSchdule || error)
        return next(
            new ApiError("حدث خطأ أثناء حذف الدوام، حاول مرة اخرى", 400),
        );

    await deleteByPattern("doctor-schedules:*");
    await deleteCache(CACHE_KEYS.DOCTOR_SCHEDULE(deleteSchdule.doctor_id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

    // Response
    res.status(200).json({
        status: "success",
        message: "تم حذف الدوام بنجاح",
        results: deleteSchdule,
    });
});

// @Desc Change Doctor Schedule Status
// @Route PATCH : /api/doctor-schedules/:id/status
// @Access Private (Admin)
export const changeDoctorScheduleStatus = AsyncHandler(
    async (req, res, next) => {
        const {id} = req.params;

        // Check schedule
        const {data: schedule, error: scheduleError} = await supabase
            .from("doctor_schedule")
            .select("*")
            .eq("schedule_id", id)
            .single();

        if (!schedule || scheduleError)
            return next(new ApiError("الدوام غير موجود", 404));

        // Toggle status
        const newStatus = schedule.status === "active" ? "inactive" : "active";

        // Update status
        const {data: updatedSchedule, error} = await supabase
            .from("doctor_schedule")
            .update({
                status: newStatus,
            })

            .eq("schedule_id", id)

            .select("*")

            .single();

        if (!updatedSchedule || error)
            return next(new ApiError("حدث خطأ أثناء تحديث حالة الدوام", 400));

        await deleteByPattern("doctor-schedules:*");
        await deleteCache(CACHE_KEYS.DOCTOR_SCHEDULE(updatedSchedule.doctor_id));
        await deleteCache(CACHE_KEYS.DASHBOARD);

        // Response
        res.status(200).json({
            status: "success",

            message:
                newStatus === "active"
                    ? "تم تفعيل الدوام بنجاح"
                    : "تم إيقاف الدوام بنجاح",

            results: updatedSchedule,
        });
    },
);
