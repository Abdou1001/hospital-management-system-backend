import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
import {getPublicImageUrl} from "../services/storage.service.js";
import {STORAGE_BUCKETS} from "../config/storage.js";
import {
    replaceImage,
    rollbackUploadedImage,
    uploadAndProcessImage,
} from "../services/imageUpload.service.js";
import {
    deleteByPattern,
    deleteCache,
    getCache,
    setCache,
} from "../services/cache.service.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";

// @Desc Get all Doctors with pagination, search, filters and sorting
// @Route GET : /api/doctors/
// Examples:
// GET /api/doctors?page=1&limit=10
// GET /api/doctors?keyword=سعيد
// GET /api/doctors?status=active
// GET /api/doctors?gender=male
// GET /api/doctors?min_experience=5
// GET /api/doctors?min_fee=1000&max_fee=5000
// GET /api/doctors?sort=-consultation_fee
// @Access Public
export const getDoctorsInfo = AsyncHandler(async (req, res, next) => {
    // Pagination
    const {page, limit, from, to} = paginate(req);

    // Filters
    const {
        keyword = "",
        status,
        gender,
        min_experience,
        max_experience,
        min_fee,
        max_fee,
        sort = "full_name",
    } = req.query;

    // Cache Key
    const cacheKey = `doctors:page=${page}:limit=${limit}:keyword=${keyword}:status=${status || "all"}:gender=${gender || "all"}:minExp=${min_experience || 0}:maxExp=${max_experience || "max"}:minFee=${min_fee || 0}:maxFee=${max_fee || "max"}:sort=${sort}`;

    // Check Redis Cache
    const cachedDoctors = await getCache(cacheKey);

    if (cachedDoctors) {
        cachedDoctors.results.forEach((doctor) => {
            doctor.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                doctor.path_image,
            );
        });

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            pagination: cachedDoctors.pagination,
            results: cachedDoctors.results,
        });
    }

    // Base Query
    let query = supabase
        .from("doctor")
        .select(
            `
            *,
            doctor_department (
                doctor_deprtment_id,
                department (
                    depart_id,
                    depart_name,
                    path_image
                )
            ),
            doctor_schedule (
                schedule_id,
                day_of_week,
                shift_type,
                start_time,
                end_time,
                status,
                max_patients
            )
            `,
            {count: "exact"},
        )
        .or(
            `full_name.ilike.%${keyword}%,bio.ilike.%${keyword}%,education.ilike.%${keyword}%`,
        );

    // Filters
    if (status) query = query.eq("status", status);

    if (gender) query = query.eq("gender", gender);

    if (min_experience) query = query.gte("years_exper", min_experience);

    if (max_experience) query = query.lte("years_exper", max_experience);

    if (min_fee) query = query.gte("consultation_fee", min_fee);

    if (max_fee) query = query.lte("consultation_fee", max_fee);

    // Sorting
    query = query.order(sort.startsWith("-") ? sort.substring(1) : sort, {
        ascending: !sort.startsWith("-"),
    });

    // Execute Query
    const {data: doctors, error, count} = await query.range(from, to);

    if (error || !doctors) {
        return next(new ApiError("حدث خطأ أثناء جلب الأطباء", 500));
    }

    // Pagination
    const pagination = paginationResult(page, limit, count);

    // Save Cache
    await setCache(
        cacheKey,
        {
            pagination,
            results: doctors,
        },
        CACHE_TTL.DOCTORS,
    );

    // Replace image path with public url
    doctors.forEach((doctor) => {
        doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            doctor.path_image,
        );
    });

    // Response
    res.status(200).json({
        status: "success",
        message: "تم جلب الأطباء بنجاح",
        pagination,
        results: doctors,
    });
});

// @Desc Get one Doctor
// @Route GET : /api/doctors/:id
// @Access Public
export const getOneDoctorInfo = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const cacheKey = CACHE_KEYS.DOCTOR(id);

    // Check Redis Cache
    const cachedDoctor = await getCache(cacheKey);

    if (cachedDoctor) {
        cachedDoctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            cachedDoctor.path_image,
        );

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedDoctor,
        });
    }

    // Query
    const {data: doctor, error} = await supabase
        .from("doctor")
        .select(
            `
            *,
            doctor_department (
                doctor_deprtment_id,
                department (
                    depart_id,
                    depart_name,
                    path_image
                )
            ),
            doctor_schedule (
                schedule_id,
                day_of_week,
                shift_type,
                start_time,
                end_time,
                status,
                max_patients,
                notes
            )
            `,
        )
        .eq("doctor_id", id)
        .single();

    // Error
    if (!doctor || error) {
        return next(new ApiError("حدث خطأ في جلب الطبيب، حاول مرة أخرى", 404));
    }

    // Save Cache
    await setCache(cacheKey, doctor, CACHE_TTL.DOCTORS);

    // Add public image url
    doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        doctor.path_image,
    );

    // Response
    res.status(200).json({
        status: "success",
        message: "تم جلب الطبيب بنجاح",
        results: doctor,
    });
});

// @Desc Insert one doctor
// @Route POST : /api/doctors/
// @Access private (Admin)
export const insertDoctor = AsyncHandler(async (req, res, next) => {
    const {
        full_name,
        email,
        bio,
        education,
        gender,
        years_exper,
        phone_number,
        notes,
        consultation_fee,
    } = req.body;

    let path_image = null;

    try {
        // Upload image
        path_image = await uploadAndProcessImage(
            STORAGE_BUCKETS.DOCTORS,
            req.file,
        );

        const {data: doctor, error} = await supabase
            .from("doctor")
            .insert({
                full_name,
                email,
                bio,
                education,
                gender,
                years_exper,
                phone_number,
                path_image,
                notes,
                status: "active",
                consultation_fee,
            })
            .select("*")
            .single();

        if (error)
            throw new ApiError(
                "حدث خطاء أثناء إضافة الطبيب، حاول مرة اخرى",
                400,
            );

        // Delete caching to update data
        await deleteByPattern("doctors:*");
        await deleteCache(CACHE_KEYS.DASHBOARD);

        doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            doctor.path_image,
        );

        res.status(201).json({
            status: "success",
            message: "تم اضافة الطبيب بنجاح",
            results: doctor,
        });
    } catch (err) {
        await rollbackUploadedImage(STORAGE_BUCKETS.DOCTORS, path_image);

        return next(err);
    }
});

// @Desc Update one doctor
// @Route PUT : /api/doctors/:id
// @Access Private (Admin)
export const updateDoctor = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {
        full_name,
        email,
        bio,
        education,
        gender,
        years_exper,
        phone_number,
        notes,
        status,
        consultation_fee,
    } = req.body;

    // Get current doctor
    const {data: currentDoctor, error: currentError} = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single();

    if (!currentDoctor || currentError)
        return next(new ApiError("الطبيب غير موجود", 404));

    const doctor = await replaceImage({
        bucket: STORAGE_BUCKETS.DOCTORS,

        currentImage: currentDoctor.path_image,

        file: req.file,

        action: async (path_image) => {
            const {data, error} = await supabase
                .from("doctor")
                .update({
                    full_name,
                    email,
                    bio,
                    education,
                    gender,
                    years_exper,
                    phone_number,
                    path_image,
                    notes,
                    status,
                    consultation_fee,
                })
                .eq("doctor_id", id)
                .select("*")
                .single();

            if (!data || error)
                throw new ApiError("حدث خطأ أثناء تعديل بيانات الطبيب", 400);

            return data;
        },
    });

    // Delete caching to update data
    await deleteByPattern("doctors:*");
    await deleteCache(CACHE_KEYS.DOCTOR(id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

    doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        doctor.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم تعديل الطبيب بنجاح",
        results: doctor,
    });
});

// @Desc Toggle doctor booking status
// @Route PATCH : /api/doctors/:id/status
// @Access Private (Admin)
export const changeDoctorStatus = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {data: doctor, error} = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single();

    if (!doctor || error) return next(new ApiError("الطبيب غير موجود", 404));

    const {data: updatedDoctor} = await supabase
        .from("doctor")
        .update({
            status: doctor.status === "active" ? "inactive" : "active",
        })
        .eq("doctor_id", id)
        .select("*")
        .single();

    // Delete caching to update data
    await deleteByPattern("doctors:*");
    await deleteCache(CACHE_KEYS.DOCTOR(id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

    doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        doctor.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم تغيير حالة الطبيب بنجاح",
        results: updatedDoctor,
    });
});

// @Desc Show or hide doctor
// @Route PATCH : /api/doctors/:id/is_hidden
// @Access Private (Admin)
export const toggleDoctorVisibility = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {data: doctor, error} = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single();

    if (!doctor || error) return next(new ApiError("الطبيب غير موجود", 404));

    const {data: updatedDoctor} = await supabase
        .from("doctor")
        .update({
            is_hidden: !doctor.is_hidden,
        })
        .eq("doctor_id", id)
        .select("*")
        .single();

    // Delete caching to update data
    await deleteByPattern("doctors:*");
    await deleteCache(CACHE_KEYS.DOCTOR(id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

    doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        doctor.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم التغيير الطبيب بنجاح",
        results: updatedDoctor,
    });
});
