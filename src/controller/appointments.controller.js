import { supabase } from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";


const platform_fee_ = 500;
const selectStatment = `*,doctor (doctor_id,full_name,path_image),user (user_id,full_name,email,phone_number,age,gender)`

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
    const { page, limit, from, to } = paginate(req);

    // Filters
    const {
        keyword = "",
        status,
        doctor_id,
        appointment_date,
        from_date,
        to_date,
        shift_type,
        patient_gender,
        sort = "-created_at"
    } = req.query;

    // Base Query
    let query = supabase
        .from("appointment")
        .select(selectStatment, {
            count: "exact"
        })
        .or(
            `patient_name.ilike.%${keyword}%,patient_phone.ilike.%${keyword}%`
        );

    // Filter by status
    if (status)
        query = query.eq(
            "status",
            status
        );

    // Filter by doctor
    if (doctor_id)
        query = query.eq(
            "doctor_id",
            doctor_id
        );

    // Filter by appointment date
    if (appointment_date)
        query = query.eq(
            "appointment_date",
            appointment_date
        );

    // Filter by date range
    if (from_date)
        query = query.gte(
            "appointment_date",
            from_date
        );

    if (to_date)
        query = query.lte(
            "appointment_date",
            to_date
        );

    // Filter by shift type
    if (shift_type)
        query = query.eq(
            "shift_type",
            shift_type
        );

    // Filter by patient gender
    if (patient_gender)
        query = query.eq(
            "patient_gender",
            patient_gender
        );


    // Sorting Descending
    if (sort.startsWith("-")) {
        query = query.order(
            sort.substring(1),
            {
                ascending: false
            }
        );
    }
    // Sorting Ascending
    else {
        query = query.order(
            sort,
            {
                ascending: true
            }
        );
    }


    // Execute Query
    const { data: appoint, error, count } = await query.range(from, to);


    // Error
    if (!appoint || error)

        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الطلبات",
                500
            )
        );


    // Response
    res.status(200).json({

        status: "success",

        pagination:
            paginationResult(
                page,
                limit,
                count
            ),

        results:
            appoint

    });

});


// @Desc Get one appointments
// @Route GET : /api/appointments/:id
// @Access Private (Admin, Reception)
export const getOneAppointmentInfo = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const {
        data: appoint,
        error
    } = await supabase

        .from("appointment")

        .select(selectStatment, {
            count: "exact"
        })

        .eq(
            "appointment_id",
            id
        )

        .single();


    if (!appoint || error)
        return next(
            new ApiError(
                "الحجز غير موجود، حاول مرة اخرى",
                404
            )
        );


    res.status(200).json({

        status: "success",

        results:
            appoint

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
// @Access Private (User)
export const getMyAppointments = AsyncHandler(async (req, res, next) => {

    // Pagination
    const { page, limit, from, to } = paginate(req);

    // Filters
    const {
        keyword = "",
        status,
        from_date,
        to_date,
        sort = "-created_at"
    } = req.query;


    // Base Query
    let query = supabase

        .from("appointment")

        .select(selectStatment, {
            count: "exact"
        })

        .eq(
            "user_id",
            req.user.user_id
        );


    // Search
    if (keyword)

        query = query.or(
            `patient_name.ilike.%${keyword}%, patient_phone.ilike.%${keyword}%`
        );


    // Status Filter
    if (status)

        query = query.eq(
            "status",
            status
        );


    // Date Range
    if (from_date)

        query = query.gte(
            "appointment_date",
            from_date
        );


    if (to_date)

        query = query.lte(
            "appointment_date",
            to_date
        );


    // Sorting Descending
    if (sort.startsWith("-")) {

        query = query.order(
            sort.substring(1),
            {
                ascending: false
            }
        );

    }

    // Sorting Ascending
    else {

        query = query.order(
            sort,
            {
                ascending: true
            }
        );

    }


    // Execute Query
    const {
        data: appointments,
        error,
        count
    } = await query.range(
        from,
        to
    );


    // Error
    if (!appointments || error)

        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الحجوزات",
                500
            )
        );


    // Response
    res.status(200).json({

        status: "success",

        pagination:
            paginationResult(
                page,
                limit,
                count
            ),

        results:
            appointments

    });

});


// @Desc Create new appointment
// @Route POST : /api/appointments
// @Access Private (User)
export const createAppointment = AsyncHandler(async (req, res, next) => {

    const {
        doctor_id,
        patient_name,
        patient_phone,
        patient_age,
        patient_gender,
        notes,
        payment_receipt,
        appointment_date,
        shift_type
    } = req.body;

    // Check doctor
    const { data: doctor, error: doctorError } = await supabase
        .from("doctor")
        .select(`doctor_id,full_name,consultation_fee,status,is_hidden`)
        .eq(
            "doctor_id",
            doctor_id
        )
        .single();

    if (!doctor || doctorError)

        return next(
            new ApiError(
                "الطبيب غير موجود",
                404
            )
        );

    // Check doctor hidden
    if (doctor.is_hidden)

        return next(
            new ApiError(
                "الطبيب غير متاح للحجز",
                400
            )
        );


    // Check doctor status
    if (doctor.status !== "active")

        return next(
            new ApiError(
                "الطبيب لا يستقبل حجوزات حالياً",
                400
            )
        );


    // Prevent duplicate request
    const { data: existingAppointment } = await supabase
        .from("appointment")
        .select("appointment_id")
        .eq(
            "doctor_id",
            doctor_id
        )
        .eq(
            "appointment_date",
            appointment_date
        )
        .eq(
            "shift_type",
            shift_type
        )
        .eq(
            "patient_phone",
            patient_phone
        )
        .single();


    if (existingAppointment)

        return next(
            new ApiError(
                "يوجد طلب حجز مسبق بنفس البيانات",
                400
            )
        );


    // Calculate fees
    const doctor_fee = doctor.consultation_fee;
    const platform_fee = platform_fee_;

    const total_amount =
        doctor_fee +
        platform_fee;


    // Create appointment
    const {
        data: appoint, error } = await supabase
            .from("appointment")
            .insert({
                user_id: req.user.user_id,
                doctor_id,
                patient_name,
                patient_phone,
                patient_age,
                patient_gender,
                notes,
                payment_receipt,
                appointment_date,
                shift_type,
                doctor_fee,
                platform_fee,
                total_amount,
                status: "pending",
                admin_notes: null,
                created_at: new Date()
            })

            .select(selectStatment, {
                count: "exact"
            })

            .single();


    if (!appoint || error)

        return next(
            new ApiError(
                "حدث خطأ أثناء إنشاء الحجز",
                400
            )
        );


    res.status(201).json({

        status: "success",

        message:
            "تم إرسال طلب الحجز بنجاح",

        results:
            appoint

    });

});


// @Desc Update my appointment
// @Route PUT : /api/appointments/:id
// @Access Private (User)
export const updateAppointment = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const {
        patient_name,
        patient_phone,
        patient_age,
        patient_gender,
        notes,
        payment_receipt,
        appointment_date,
        shift_type
    } = req.body;


    // Check appointment
    const {
        data: currentAppointment,
        error: currentError
    } = await supabase

        .from("appointment")
        .select("*")
        .eq(
            "appointment_id",
            id
        )
        .eq(
            "user_id",
            req.user.user_id
        )
        .single();


    if (!currentAppointment || currentError)

        return next(
            new ApiError(
                "الحجز غير موجود",
                404
            )
        );


    // Allow edit only while pending
    if (
        currentAppointment.status !==
        "pending"
    )

        return next(
            new ApiError(
                "لا يمكن تعديل الحجز بعد مراجعته",
                400
            )
        );


    const {
        data: appointment,
        error
    } = await supabase

        .from("appointment")
        .update({
            patient_name,
            patient_phone,
            patient_age,
            patient_gender,
            notes,
            payment_receipt,
            appointment_date,
            shift_type
        })

        .eq(
            "appointment_id",
            id
        )

        .select(selectStatment, {
            count: "exact"
        })

        .single();


    if (!appointment || error)

        return next(
            new ApiError(
                "حدث خطأ أثناء تعديل الحجز",
                400
            )
        );


    res.status(200).json({

        status: "success",

        message:
            "تم تعديل الحجز بنجاح",

        results:
            appointment

    });

});



// @Desc Change Status of appointment
// @Route PATCH : /api/appointments/:id/status
// @Access Private (Admin, Reception)
export const changeAppointmentsStatus = AsyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const { status, admin_notes } = req.body;

    const { data: appoint, error } = await supabase
        .from("appointment")
        .select(selectStatment)
        .eq("appointment_id", id)
        .single();


    if (!appoint || error)
        return next(new ApiError("الحجز غير موجود، حاول مرة اخرى"), 404);



    const { data: ChangeAppoint, error: changeError } = await supabase
        .from("appointment")
        .update({
            status,
            admin_notes
        })
        .eq("appointment_id", id)
        .select(selectStatment, {
            count: "exact"
        })
        .single();


    if (!ChangeAppoint || changeError)
        return next(new ApiError("حدث خطأ أثناء تحديث حالة الحجز، حاول مرة اخرى"), 400);



    res.status(200).json({

        status: "success",

        message:
            "تم تحديث حالة الحجز بنجاح",

        results:
            ChangeAppoint

    });
})



// @Desc Cancel my appointment
// @Route PATCH : /api/appointments/:id/cancel
// @Access Private (User)
export const cancelAppointment = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    // Check appointment
    const {
        data: appoint,
        error
    } = await supabase

        .from("appointment")

        .select(selectStatment)

        .eq(
            "appointment_id",
            id
        )

        .eq(
            "user_id",
            req.user.user_id
        )

        .single();


    if (!appoint || error)

        return next(
            new ApiError(
                "الحجز غير موجود",
                404
            )
        );


    // Prevent cancelling rejected or approved appointment
    if (
        appoint.status === "approved" ||
        appoint.status === "rejected"
    )

        return next(
            new ApiError(
                "لا يمكن تعديل الحجز بعد مراجعته",
                400
            )
        );


    // Prevent cancelling already cancelled appointment
    if (
        appoint.status === "cancelled"
    )

        return next(
            new ApiError(
                "تم إلغاء الحجز مسبقاً",
                400
            )
        );


    // Cancel appointment
    const {
        data: cancelledAppointment,
        error: cancelError
    } = await supabase

        .from("appointment")

        .update({
            status: "cancelled",
        })

        .eq(
            "appointment_id",
            id
        )

        .select(selectStatment)

        .single();


    if (!cancelledAppointment || cancelError)

        return next(
            new ApiError(
                "حدث خطأ أثناء إلغاء الحجز",
                400
            )
        );


    res.status(200).json({

        status: "success",

        message:
            "تم إلغاء الحجز بنجاح",

        results:
            cancelledAppointment

    });

});



