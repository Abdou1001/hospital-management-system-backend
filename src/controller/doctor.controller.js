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
import {
    createDoctorWithRelations,
    updateDoctorWithRelations,
} from "../services/doctor.service.js";

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
                    depart_name
                )
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
                    depart_name
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
    let path_image = null;

    try {
        /* ==========================================
           1. رفع صورة الطبيب
        ========================================== */

        path_image = await uploadAndProcessImage(
            STORAGE_BUCKETS.DOCTORS,
            req.file,
        );

        /* ==========================================
           2. قراءة الأقسام
           
           Frontend سيرسلها كـ JSON داخل FormData:
           
           "[1,2,3]"
        ========================================== */

        const departmentIds = req.body.department_ids
            ? JSON.parse(req.body.department_ids)
            : [];

        /* ==========================================
           3. قراءة الدوامات
           
           Frontend سيرسلها كـ JSON:
           
           [
             {
               day_of_week: "الاحد",
               shift_type: "صباحي",
               start_time: "08:00",
               end_time: "12:00"
             }
           ]
        ========================================== */

        const schedules = req.body.schedules
            ? JSON.parse(req.body.schedules)
            : [];

        /* ==========================================
           4. تجهيز بيانات الطبيب

           نحول القيم الرقمية من FormData
           لأنها تصل من multipart/form-data
           على شكل String.
        ========================================== */

        const doctor = {
            full_name: req.body.full_name,

            email: req.body.email || null,

            bio: req.body.bio || null,

            education: req.body.education || null,

            gender: req.body.gender || null,

            years_exper: req.body.years_exper
                ? Number(req.body.years_exper)
                : null,

            phone_number: req.body.phone_number || null,

            notes: req.body.notes || null,

            consultation_fee: req.body.consultation_fee
                ? Number(req.body.consultation_fee)
                : null,
        };

        /* ==========================================
           5. تنفيذ العملية كاملة

           هنا Request واحد فقط إلى PostgreSQL

           doctor
           departments
           schedules

           كلها داخل Function واحدة.
        ========================================== */

        const doctorResult = await createDoctorWithRelations({
            doctor,
            pathImage: path_image,
            departmentIds,
            schedules,
        });

        /* ==========================================
           6. حذف Cache القديم

           لأن بيانات الأطباء تغيرت.
        ========================================== */

        await Promise.all([
            deleteByPattern("doctors:*"),
            deleteByPattern("doctor-departments:*"),
            deleteByPattern("doctor-schedules:*"),
            deleteByPattern("departments:*"),
            deleteCache(CACHE_KEYS.DASHBOARD),
            ...departmentIds.map((deptId) =>
                deleteCache(CACHE_KEYS.DEPARTMENT_DOCTORS(deptId)),
            ),
        ]);

        /* ==========================================
           7. تحويل مسار الصورة إلى Public URL

           PostgreSQL يرجع path_image فقط.
        ========================================== */

        if (doctorResult?.path_image) {
            doctorResult.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                doctorResult.path_image,
            );
        }

        /* ==========================================
           8. إرسال Response للـ Frontend
        ========================================== */

        res.status(201).json({
            status: "success",

            message: "تم اضافة الطبيب بنجاح",

            results: doctorResult,
        });
    } catch (err) {
        /* ==========================================
           9. Rollback للصورة

           PostgreSQL يستطيع Rollback للـ Database،
           لكن Storage ليس جزءًا من Transaction.

           لذلك إذا فشل RPC بعد رفع الصورة،
           نحذف الصورة يدويًا.
        ========================================== */

        await rollbackUploadedImage(STORAGE_BUCKETS.DOCTORS, path_image);

        return next(err);
    }
});

// @Desc Update one doctor with relations
// @Route PUT : /api/doctors/:id
// @Access Private (Admin)
export const updateDoctor = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    let path_image = null;

    try {
        /* ==========================================
           1. قراءة الأقسام
        ========================================== */

        const departmentIds = req.body.department_ids
            ? JSON.parse(req.body.department_ids)
            : [];

        /* ==========================================
           2. قراءة الدوامات
        ========================================== */

        const schedules = req.body.schedules
            ? JSON.parse(req.body.schedules)
            : [];

        /* ==========================================
           3. تجهيز بيانات الطبيب
        ========================================== */

        const doctor = {
            full_name: req.body.full_name,

            email: req.body.email || null,

            bio: req.body.bio || null,

            education: req.body.education || null,

            gender: req.body.gender || null,

            years_exper: req.body.years_exper
                ? Number(req.body.years_exper)
                : null,

            phone_number: req.body.phone_number || null,

            notes: req.body.notes || null,

            status: req.body.status || null,

            consultation_fee: req.body.consultation_fee
                ? Number(req.body.consultation_fee)
                : null,
        };

        /* ==========================================
           4. الحصول على الصورة الحالية
        ========================================== */

        const {data: currentDoctor, error: currentError} = await supabase
            .from("doctor")
            .select("doctor_id, path_image")
            .eq("doctor_id", id)
            .single();

        if (!currentDoctor || currentError) {
            return next(new ApiError("الطبيب غير موجود", 404));
        }

        /* ==========================================
           5. استبدال الصورة إذا تم إرسال صورة جديدة

           replaceImage يتولى:
           - رفع الصورة الجديدة
           - تنفيذ العملية
           - حذف الصورة القديمة عند النجاح
        ========================================== */

        const result = await replaceImage({
            bucket: STORAGE_BUCKETS.DOCTORS,

            currentImage: currentDoctor.path_image,

            file: req.file,

            action: async (newPathImage) => {
                path_image = newPathImage || currentDoctor.path_image;

                /* ======================================
                   6. استدعاء PostgreSQL RPC

                   هنا تتم العملية كاملة:

                   Doctor
                   Departments
                   Schedules
                ====================================== */

                return await updateDoctorWithRelations({
                    doctorId: Number(id),

                    doctor,

                    pathImage: path_image,

                    departmentIds,

                    schedules,
                });
            },
        });

        /* ==========================================
           7. حذف Cache
        ========================================== */

        await Promise.all([
            // Cache قائمة الأطباء
            deleteByPattern("doctors:*"),

            // Cache علاقات الأطباء بالأقسام
            deleteByPattern("doctor-departments:*"),

            // Cache دوامات الأطباء
            deleteByPattern("doctor-schedules:*"),

            // Cache الأقسام لتحديث العدادات
            deleteByPattern("departments:*"),

            // Cache الطبيب نفسه
            deleteCache(CACHE_KEYS.DOCTOR(id)),

            // Cache أقسام هذا الطبيب تحديدًا
            deleteCache(CACHE_KEYS.DOCTOR_DEPARTMENTS(id)),

            // Cache دوامات هذا الطبيب تحديدًا
            deleteCache(CACHE_KEYS.DOCTOR_SCHEDULE(id)),

            // Cache لوحة التحكم
            deleteCache(CACHE_KEYS.DASHBOARD),

            ...departmentIds.map((deptId) =>
                deleteCache(CACHE_KEYS.DEPARTMENT_DOCTORS(deptId)),
            ),
        ]);

        /* ==========================================
           8. تحويل الصورة إلى Public URL
        ========================================== */

        if (result?.path_image) {
            result.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                result.path_image,
            );
        }

        /* ==========================================
           9. Response
        ========================================== */

        res.status(200).json({
            status: "success",

            message: "تم تعديل الطبيب بنجاح",

            results: result,
        });
    } catch (err) {
        /* ==========================================
           Rollback للصورة إذا فشلت العملية
        ========================================== */

        await rollbackUploadedImage(STORAGE_BUCKETS.DOCTORS, path_image);

        return next(err);
    }
});

// @Desc Toggle doctor booking status
// @Route PATCH : /api/doctors/:id/status
// @Access Private (Admin)
export const changeDoctorStatus = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {data: doctor, error} = await supabase
        .from("doctor")
        .select("doctor_id, status")
        .eq("doctor_id", id)
        .single();

    if (!doctor || error) return next(new ApiError("الطبيب غير موجود", 404));

    const {data: updatedDoctor} = await supabase
        .from("doctor")
        .update({
            status: doctor.status === "active" ? "inactive" : "active",
        })
        .eq("doctor_id", id)
        .select("doctor_id, status")
        .single();

    // Delete caching to update data
    await deleteByPattern("doctors:*");
    await deleteCache(CACHE_KEYS.DOCTOR(id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

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
        .select("doctor_id, is_hidden")
        .eq("doctor_id", id)
        .single();

    if (!doctor || error) return next(new ApiError("الطبيب غير موجود", 404));

    const {data: updatedDoctor} = await supabase
        .from("doctor")
        .update({
            is_hidden: !doctor.is_hidden,
        })
        .eq("doctor_id", id)
        .select("doctor_id, is_hidden")
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
