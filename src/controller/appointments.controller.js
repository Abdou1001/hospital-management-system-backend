import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
import { STORAGE_BUCKETS } from "../config/storage.js";
import { createSignedImageUrl, getPublicImageUrl } from "../services/storage.service.js";
import { replaceImage, rollbackUploadedImage, uploadAndProcessImage } from "../services/imageUpload.service.js";

const platform_fee_ = 500;
const selectStatment = `*,doctor (doctor_id,full_name,path_image),user (user_id,full_name,email,phone_number,age,gender)`;

// @Desc Get all appointments with pagination, search, filters and sorting
// @Route GET : /api/appointments
// Examples:
// GET /api/appointments?page=1&limit=10
// GET /api/appointments?keyword=محمد
// GET /api/appointments?status=pending
// GET /api/appointments?doctor_id=1
// GET /api/appointments?appointment_date=2026-06-10
// GET /api/appointments?from_date=2026-06-01&to_date=2026-06-30
// GET /api/appointments?shift_type=morning
// GET /api/appointments?patient_gender=male
// GET /api/appointments?sort=-created_at
// @Access Private (Admin, Reception)
export const getAppointmentsInfo = AsyncHandler(async (req, res, next) => {
    // Pagination
    const {page, limit, from, to} = paginate(req);

    // Filters
    const {
        keyword = "",
        status,
        day_of_week,
        appointment_date,
        from_date,
        to_date,
        patient_gender,
        sort = "-created_at",
    } = req.query;

    // Base Query
    let query = supabase.from("appointment").select(selectStatment, {
        count: "exact",
    });

    // Search for doctor or patient's name or Phone
    if (keyword) {
        const {data: doctors} = await supabase
            .from("doctor")
            .select("doctor_id")
            .ilike("full_name", `%${keyword}%`);

        const doctorIds = doctors?.map((doctor) => doctor.doctor_id) || [];

        const {data: schedules} = await supabase
            .from("doctor_schedule")
            .select("schedule_id")
            .in("doctor_id", doctorIds);

        const scheduleIds =
            schedules?.map((schedule) => schedule.schedule_id) || [];

        query = query.or(
            `patient_name.ilike.%${keyword}%,patient_phone.ilike.%${keyword}%,schedule_id.in.(${scheduleIds.join(",")})`,
        );
    }

    // Filter by status
    if (status) query = query.eq("status", status);

    // Filter by appointment date
    if (appointment_date)
        query = query.eq("appointment_date", appointment_date);

    // Filter by date range
    if (from_date) query = query.gte("appointment_date", from_date);

    if (to_date) query = query.lte("appointment_date", to_date);

    // Filter by patient gender
    if (patient_gender) query = query.eq("patient_gender", patient_gender);

    // Filter by Day of week
    if (day_of_week) {
        const {data: schedules} = await supabase
            .from("doctor_schedule")
            .select("schedule_id")
            .eq("day_of_week", day_of_week);

        const scheduleIds =
            schedules?.map((schedule) => schedule.schedule_id) || [];

        query = query.in("schedule_id", scheduleIds);
    }

    // Sorting Descending
    if (sort.startsWith("-")) {
        query = query.order(sort.substring(1), {
            ascending: false,
        });
    }
    // Sorting Ascending
    else {
        query = query.order(sort, {
            ascending: true,
        });
    }

    // Execute Query
    const {data: appoint, error, count} = await query.range(from, to);

    // Error
    if (!appoint || error)
        return next(new ApiError("حدث خطأ أثناء جلب الطلبات", 500));

    // Replace image paths
    for (const appointment of appoint) {
        appointment.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            appointment.doctor.path_image,
        );

        if (appointment.payment_receipt) {
            try {
                appointment.payment_receipt = await createSignedImageUrl(
                    STORAGE_BUCKETS.PAYMENT_RECEIPTS,
                    appointment.payment_receipt,
                );
            } catch {
                appointment.payment_receipt = null;
            }
        }
    }

    // Response
    res.status(200).json({
        status: "success",

        message: "تم جلب الحجوزات بنجاح",

        pagination: paginationResult(page, limit, count),

        results: appoint,
    });
});

// @Desc Get one appointments
// @Route GET : /api/appointments/:id
// @Access Private (Admin, Reception)
export const getOneAppointmentInfo = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {data: appoint, error} = await supabase
        .from("appointment")
        .select(selectStatment, {
            count: "exact",
        })
        .eq("appointment_id", id)
        .single();

    if (!appoint || error)
        return next(new ApiError("الحجز غير موجود، حاول مرة اخرى", 404));

    if (appoint.doctor?.path_image) {
        appoint.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            appoint.doctor.path_image,
        );
    }

    if (appoint.payment_receipt) {
        try {
            appoint.payment_receipt = await createSignedImageUrl(
                STORAGE_BUCKETS.PAYMENT_RECEIPTS,
                appoint.payment_receipt,
            );
        } catch {
            appoint.payment_receipt = null;
        }
    }

    res.status(200).json({
        status: "success",
        message: "تم جلب الحجز بنجاح",

        results: appoint,
    });
});

// @Desc Get my appointments
// @Route GET : /api/appointments/my
// Examples:
// GET /api/appointments/my
// GET /api/appointments/my?keyword=محمد
// GET /api/appointments/my?status=pending
// GET /api/appointments/my?from_date=2026-06-01&to_date=2026-06-30
// GET /api/appointments/my?sort=-created_at
// @Access public (User)
export const getMyAppointments = AsyncHandler(async (req, res, next) => {
    // Pagination
    const {page, limit, from, to} = paginate(req);

    // Filters
    const {
        keyword = "",
        status,
        from_date,
        to_date,
        day_of_week,
        sort = "-created_at",
    } = req.query;

    // Base Query
    let query = supabase
        .from("appointment")
        .select(selectStatment, {
            count: "exact",
        })
        .eq("user_id", req.user.user_id);

    // Search
    if (keyword) {
        const {data: doctors} = await supabase
            .from("doctor")
            .select("doctor_id")
            .ilike("full_name", `%${keyword}%`);

        const doctorIds = doctors?.map((doctor) => doctor.doctor_id) || [];

        const {data: schedules} = await supabase
            .from("doctor_schedule")
            .select("schedule_id")
            .in("doctor_id", doctorIds);

        const scheduleIds =
            schedules?.map((schedule) => schedule.schedule_id) || [];

        const conditions = [
            `patient_name.ilike.%${keyword}%`,
            `patient_phone.ilike.%${keyword}%`,
        ];

        if (scheduleIds.length > 0)
            conditions.push(`schedule_id.in.(${scheduleIds.join(",")})`);

        query = query.or(conditions.join(","));
    }

    // Status Filter
    if (status) query = query.eq("status", status);

    // Date Range
    if (from_date) query = query.gte("appointment_date", from_date);

    if (to_date) query = query.lte("appointment_date", to_date);

    if (day_of_week) {
        const {data: schedules} = await supabase
            .from("doctor_schedule")
            .select("schedule_id")
            .eq("day_of_week", day_of_week);

        const scheduleIds =
            schedules?.map((schedule) => schedule.schedule_id) || [];

        query = query.in("schedule_id", scheduleIds);
    }

    // Sorting Descending
    if (sort.startsWith("-")) {
        query = query.order(sort.substring(1), {
            ascending: false,
        });
    }

    // Sorting Ascending
    else {
        query = query.order(sort, {
            ascending: true,
        });
    }

    // Execute Query
    const {data: appointments, error, count} = await query.range(from, to);

    // Error
    if (!appointments || error)
        return next(new ApiError("حدث خطأ أثناء جلب الحجوزات", 500));

    // Replace image paths
    for (const appointment of appointments) {
        if (appointment.doctor?.path_image) {
            appointment.doctor.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                appointment.doctor.path_image,
            );
        }

        if (appointment.payment_receipt) {
            try {
                appointment.payment_receipt = await createSignedImageUrl(
                    STORAGE_BUCKETS.PAYMENT_RECEIPTS,
                    appointment.payment_receipt,
                );
            } catch {
                appointment.payment_receipt = null;
            }
        }
    }

    // Response
    res.status(200).json({
        status: "success",
        message: "تم جلب الحجوزات بنجاح",

        pagination: paginationResult(page, limit, count),

        results: appointments,
    });
});

// @Desc Create new appointment
// @Route POST : /api/appointments
// @Access public
export const createAppointment = AsyncHandler(async (req, res, next) => {
    const {
        schedule_id,
        patient_name,
        patient_phone,
        patient_age,
        patient_gender,
        notes,
        appointment_date,
    } = req.body;

    let payment_receipt = null;

    try {
        // Upload payment receipt
        payment_receipt = await uploadAndProcessImage(
            STORAGE_BUCKETS.PAYMENT_RECEIPTS,
            req.file,
        );

        // Get schedule with doctor
        const {data: schedule, error: scheduleError} = await supabase
            .from("doctor_schedule")
            .select(
                `*,doctor (doctor_id,full_name,consultation_fee,status,is_hidden)`,
            )
            .eq("schedule_id", schedule_id)
            .single();

        if (!schedule || scheduleError)
            throw new ApiError("الدوام غير موجود", 404);

        // Check schedule active
        if (schedule.status != "active")
            throw new ApiError("هذا الدوام غير متاح حالياً", 400);

        // Check doctor hidden
        if (schedule.doctor.is_hidden)
            throw new ApiError("الطبيب غير متاح للحجز", 400);

        // Check doctor status
        if (schedule.doctor.status !== "active")
            throw new ApiError("الطبيب لا يستقبل الحجوزات حالياً", 400);

        // Check day of week
        const appointmentDay = new Date(appointment_date).toLocaleDateString(
            "ar-SA",
            {
                weekday: "long",
                timeZone: "UTC",
            },
        );

        if (appointmentDay.toLowerCase() !== schedule.day_of_week.toLowerCase())
            throw new ApiError("الدكتور لا يداوم في هذا اليوم", 400);

        // Prevent duplicate appointment
        const {data: existingAppointment} = await supabase
            .from("appointment")
            .select("appointment_id")
            .eq("schedule_id", schedule_id)
            .eq("appointment_date", appointment_date)
            .eq("patient_phone", patient_phone)
            .single();

        if (existingAppointment)
            throw new ApiError("يوجد طلب حجز مسبق بنفس البيانات", 400);

        // Check max patients
        const {count, error: countError} = await supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("schedule_id", schedule_id)
            .eq("appointment_date", appointment_date)
            .in("status", ["pending", "approved"]);

        if (countError)
            throw new ApiError("حدث خطأ أثناء التحقق من عدد الحجوزات", 500);

        if (count >= schedule.max_patients)
            throw new ApiError(
                "تم الوصول إلى الحد الأقصى للحجوزات لهذا الدوام",
                400,
            );

        // Calculate fees
        const doctor_fee = schedule.doctor.consultation_fee;

        const platform_fee = platform_fee_;

        const total_amount = doctor_fee + platform_fee;

        // Create appointment
        const {data: appoint, error} = await supabase
            .from("appointment")
            .insert({
                user_id: req.user.user_id,
                schedule_id,
                patient_name,
                patient_phone,
                patient_age,
                patient_gender,
                notes,
                payment_receipt,
                appointment_date,
                doctor_fee,
                platform_fee,
                total_amount,
                status: "pending",
                admin_notes: null,
                created_at: new Date(),
            })
            .select("*")
            .single();

        if (!appoint || error)
            throw new ApiError("حدث خطأ أثناء إنشاء الحجز", 400);

        res.status(201).json({
            status: "success",
            message:
                "تم إرسال طلب الحجز بنجاح، انتظر حتى يتم تاكد الحجز من الاستقبال",
            results: appoint,
        });
    } catch (err) {
        await rollbackUploadedImage(
            STORAGE_BUCKETS.PAYMENT_RECEIPTS,
            payment_receipt,
        );

        return next(err);
    }
});

// @Desc Update my appointment
// @Route PUT : /api/appointments/:id
// @Access public (User)
export const updateAppointment = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {
        schedule_id,
        patient_name,
        patient_phone,
        patient_age,
        patient_gender,
        notes,
        appointment_date,
    } = req.body;

    // Check appointment
    const {data: currentAppointment, error: currentError} = await supabase
        .from("appointment")
        .select("*")
        .eq("appointment_id", id)
        .eq("user_id", req.user.user_id)
        .single();

    if (!currentAppointment || currentError)
        return next(new ApiError("الحجز غير موجود", 404));

    // Allow edit only while pending
    if (currentAppointment.status !== "pending")
        return next(new ApiError("لا يمكن تعديل الحجز بعد مراجعته", 400));

    const appointment = await replaceImage({
        bucket: STORAGE_BUCKETS.PAYMENT_RECEIPTS,
        currentImage: currentAppointment.payment_receipt,
        file: req.file,

        action: async (payment_receipt) => {
            // Get schedule
            const {data: schedule, error: scheduleError} = await supabase
                .from("doctor_schedule")
                .select(
                    `
                    *,
                    doctor (
                        doctor_id,
                        full_name,
                        consultation_fee,
                        status,
                        is_hidden
                    )
                `,
                )
                .eq("schedule_id", schedule_id)
                .single();

            if (!schedule || scheduleError)
                throw new ApiError("الدوام غير موجود", 404);

            // Check schedule active
            if (schedule.status != "active")
                throw new ApiError("هذا الدوام غير متاح حالياً", 400);

            // Check doctor
            if (schedule.doctor.is_hidden)
                throw new ApiError("الطبيب غير متاح للحجز", 400);

            if (schedule.doctor.status !== "active")
                throw new ApiError("الطبيب لا يستقبل الحجوزات حالياً", 400);

            // Check day
            const appointmentDay = new Date(
                appointment_date,
            ).toLocaleDateString("ar-SA", {
                weekday: "long",
                timeZone: "UTC",
            });

            if (
                appointmentDay.toLowerCase() !==
                schedule.day_of_week.toLowerCase()
            )
                throw new ApiError("الدكتور لا يداوم في هذا اليوم", 400);

            // Prevent duplicate appointment
            const {data: existingAppointment} = await supabase
                .from("appointment")
                .select("appointment_id")
                .eq("schedule_id", schedule_id)
                .eq("appointment_date", appointment_date)
                .eq("patient_phone", patient_phone)
                .neq("appointment_id", id)
                .single();

            if (existingAppointment)
                throw new ApiError("يوجد طلب حجز مسبق بنفس البيانات", 400);

            // Check max patients
            const {count, error: countError} = await supabase
                .from("appointment")
                .select("*", {
                    count: "exact",
                    head: true,
                })
                .eq("schedule_id", schedule_id)
                .eq("appointment_date", appointment_date)
                .neq("appointment_id", id)
                .in("status", ["pending", "approved"]);

            if (countError)
                throw new ApiError("حدث خطأ أثناء التحقق من عدد الحجوزات", 500);

            if (count >= schedule.max_patients)
                throw new ApiError(
                    "تم الوصول إلى الحد الأقصى للحجوزات لهذا الدوام",
                    400,
                );

            // Update fees
            const doctor_fee = schedule.doctor.consultation_fee;

            const platform_fee = platform_fee_;

            const total_amount = doctor_fee + platform_fee;

            // Update appointment
            const {data, error} = await supabase
                .from("appointment")
                .update({
                    doctor_id: schedule.doctor.doctor_id,
                    schedule_id,
                    patient_name,
                    patient_phone,
                    patient_age,
                    patient_gender,
                    notes,
                    payment_receipt,
                    appointment_date,
                    doctor_fee,
                    platform_fee,
                    total_amount,
                })
                .eq("appointment_id", id)
                .select(selectStatment)
                .single();

            if (!data || error)
                throw new ApiError("حدث خطأ أثناء تعديل الحجز", 400);

            return data;
        },
    });

    if (appointment.doctor?.path_image) {
        appointment.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            appointment.doctor.path_image,
        );
    }

    if (appointment.payment_receipt) {
        try {
            appointment.payment_receipt = await createSignedImageUrl(
                STORAGE_BUCKETS.PAYMENT_RECEIPTS,
                appointment.payment_receipt,
            );
        } catch {
            appointment.payment_receipt = null;
        }
    }

    res.status(200).json({
        status: "success",

        message: "تم تعديل الحجز بنجاح",

        results: appointment,
    });
});

// @Desc Change Status of appointment
// @Route PATCH : /api/appointments/:id/status
// @Access Private (Admin, Reception)
export const changeAppointmentsStatus = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {status, admin_notes} = req.body;

    // Check appointment
    const {data: appoint, error} = await supabase
        .from("appointment")
        .select(selectStatment)
        .eq("appointment_id", id)
        .single();

    if (!appoint || error) return next(new ApiError("الحجز غير موجود", 404));

    // Prevent changing cancelled appointment
    if (appoint.status === "cancelled")
        return next(new ApiError("لا يمكن تعديل حالة حجز ملغي", 400));

    // Prevent updating to same status
    if (appoint.status === status)
        return next(new ApiError("الحجز بهذه الحالة بالفعل", 400));

    // Check max patients only when approving
    if (status === "approved") {
        // Get schedule
        const {data: schedule, error: scheduleError} = await supabase
            .from("doctor_schedule")
            .select(
                `
                schedule_id,
                max_patients,
                status
            `,
            )
            .eq("schedule_id", appoint.schedule_id)
            .single();

        if (!schedule || scheduleError)
            return next(new ApiError("الدوام غير موجود", 404));

        if (schedule.status != "active")
            return next(new ApiError("هذا الدوام غير متاح حالياً", 400));

        // Count approved appointments
        const {count, error: countError} = await supabase
            .from("appointment")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("schedule_id", appoint.schedule_id)
            .eq("appointment_date", appoint.appointment_date)
            .eq("status", "approved");

        if (countError)
            return next(
                new ApiError("حدث خطأ أثناء التحقق من عدد الحجوزات", 500),
            );

        if (count >= schedule.max_patients)
            return next(
                new ApiError(
                    "تم الوصول إلى الحد الأقصى للحجوزات لهذا الدوام",
                    400,
                ),
            );
    }

    // Update appointment
    const {data: changedAppointment, error: changeError} = await supabase
        .from("appointment")
        .update({
            status,
            admin_notes,
        })
        .eq("appointment_id", id)
        .select(selectStatment)
        .single();

    if (!changedAppointment || changeError)
        return next(new ApiError("حدث خطأ أثناء تحديث حالة الحجز", 400));

    if (changedAppointment.doctor?.path_image) {
        changedAppointment.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            changedAppointment.doctor.path_image,
        );
    }

    if (changedAppointment.payment_receipt) {
        try {
            changedAppointment.payment_receipt = await createSignedImageUrl(
                STORAGE_BUCKETS.PAYMENT_RECEIPTS,
                changedAppointment.payment_receipt,
            );
        } catch {
            changedAppointment.payment_receipt = null;
        }
    }

    res.status(200).json({
        status: "success",

        message: "تم تحديث حالة الحجز بنجاح",

        results: changedAppointment,
    });
});

// @Desc Cancel my appointment
// @Route PATCH : /api/appointments/:id/cancel
// @Access public (User)
export const cancelAppointment = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    // Check appointment
    const {data: appoint, error} = await supabase

        .from("appointment")

        .select(selectStatment)

        .eq("appointment_id", id)

        .eq("user_id", req.user.user_id)

        .single();

    if (!appoint || error) return next(new ApiError("الحجز غير موجود", 404));

    // Prevent cancelling rejected or approved appointment
    if (appoint.status === "approved" || appoint.status === "rejected")
        return next(new ApiError("لا يمكن تعديل الحجز بعد مراجعته", 400));

    // Prevent cancelling already cancelled appointment
    if (appoint.status === "cancelled")
        return next(new ApiError("تم إلغاء الحجز مسبقاً", 400));

    // Cancel appointment
    const {data: cancelledAppointment, error: cancelError} = await supabase
        .from("appointment")
        .update({
            status: "cancelled",
        })
        .eq("appointment_id", id)
        .select(selectStatment)
        .single();

    if (!cancelledAppointment || cancelError)
        return next(new ApiError("حدث خطأ أثناء إلغاء الحجز", 400));

    res.status(200).json({
        status: "success",
        message: "تم إلغاء الحجز بنجاح",
        results: cancelledAppointment,
    });
});
