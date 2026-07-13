import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
import {getPublicImageUrl} from "../services/storage.service.js";
import {STORAGE_BUCKETS} from "../config/storage.js";
import {
    deleteByPattern,
    getCache,
    setCache,
} from "../services/cache.service.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";

const selectStatment = `doctor_deprtment_id,doctor (*),department (*)`;

// @Desc Get all Doctor Departments Relations
// @Route GET : /api/doctor-departments
// Examples:
// GET /api/doctor-departments
// GET /api/doctor-departments?keyword=احمد
// GET /api/doctor-departments?keyword=قلب
// @Access public
export const getDoctorDepartmentsInfo = AsyncHandler(async (req, res, next) => {
    // Pagination
    const {page, limit, from, to} = paginate(req);

    // Filters
    const {keyword = "", sort = "doctor_deprtment_id"} = req.query;

    const cacheKey = `doctor-departments:page=${page}:limit=${limit}:keyword=${keyword}:sort=${sort}`;

    // Check Redis Cache
    const cachedRelations = await getCache(cacheKey);

    if (cachedRelations) {
        cachedRelations.results.forEach((relation) => {
            relation.doctor.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                relation.doctor.path_image,
            );

            relation.department.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DEPARTMENTS,
                relation.department.path_image,
            );
        });

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            pagination: cachedRelations.pagination,
            results: cachedRelations.results,
        });
    }

    // Base Query
    let query = supabase.from("doctor_department").select(selectStatment, {
        count: "exact",
    });

    // Search by doctor name or department name
    if (keyword) {
        const {data: doctors} = await supabase
            .from("doctor")
            .select("doctor_id")
            .ilike("full_name", `%${keyword}%`);

        const {data: departments} = await supabase
            .from("department")
            .select("depart_id")
            .ilike("depart_name", `%${keyword}%`);

        const doctorIds = doctors?.map((doctor) => doctor.doctor_id) || [];

        const departmentIds =
            departments?.map((department) => department.depart_id) || [];

        // If there is no result
        if (doctorIds.length === 0 && departmentIds.length === 0) {
            return res.status(200).json({
                status: "success",
                message: "تم جلب البيانات بنجاح",

                pagination: paginationResult(page, limit, 0),

                results: [],
            });
        }

        const conditions = [];

        if (doctorIds.length > 0)
            conditions.push(`doctor_id.in.(${doctorIds.join(",")})`);

        if (departmentIds.length > 0)
            conditions.push(`depart_id.in.(${departmentIds.join(",")})`);

        query = query.or(conditions.join(","));
    }

    // Sorting
    query = query.order(sort, {
        ascending: true,
    });

    // Execute Query
    const {data: relations, error, count} = await query.range(from, to);

    // Error
    if (!relations || error)
        return next(new ApiError("حدث خطأ أثناء جلب البيانات", 500));

    const pagination = paginationResult(page, limit, count);

    await setCache(
        cacheKey,
        {
            pagination,
            results: relations,
        },
        CACHE_TTL.DOCTORS,
    );

    // Replace image path with public url
    relations.forEach((relation) => {
        relation.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            relation.doctor.path_image,
        );

        relation.department.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DEPARTMENTS,
            relation.department.path_image,
        );
    });

    // Response
    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        pagination,
        results: relations,
    });
});

// @Desc Get One Doctor Department Relation
// @Route GET : /api/doctor-departments/:id
// @Access Private (Admin)
export const getOneDoctorDepartmentInfo = AsyncHandler(
    async (req, res, next) => {
        const {id} = req.params;

        const cacheKey = CACHE_KEYS.DOCTOR_DEPARTMENT(id);

        // Check Redis Cache
        const cachedRelation = await getCache(cacheKey);

        if (cachedRelation) {
            cachedRelation.doctor.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                cachedRelation.doctor.path_image,
            );

            cachedRelation.department.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DEPARTMENTS,
                cachedRelation.department.path_image,
            );

            return res.status(200).json({
                status: "success",
                message: "تم جلب البيانات من Redis",
                results: cachedRelation,
            });
        }

        // Query
        const {data: relation, error} = await supabase
            .from("doctor_department")
            .select(selectStatment)
            .eq("doctor_deprtment_id", id)
            .single();

        // Error
        if (!relation || error)
            return next(new ApiError("علاقة الدكتور بالقسم غير موجودة", 404));

        // Save Cache
        await setCache(cacheKey, relation, CACHE_TTL.DOCTOR_DEPARTMENTS);

        // Replace image path with public url
        relation.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            relation.doctor.path_image,
        );

        relation.department.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DEPARTMENTS,
            relation.department.path_image,
        );

        res.status(200).json({
            status: "success",
            message: "تم جلب البيانات بنجاح",
            results: relation,
        });
    },
);

// @Desc Assign Doctor To Department
// @Route POST : /api/doctor-departments
// @Access Private (Admin)
export const assignDoctorToDepartment = AsyncHandler(async (req, res, next) => {
    const {doctor_id, depart_id} = req.body;

    // Check if there doctor with this id
    const {data: doctor, errorDoctors} = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", doctor_id)
        .single();

    if (!doctor || errorDoctors) {
        return next(new ApiError("الدكتور الذي اضفته غير موجود!", 404));
    }

    // Check if there department with this id
    const {data: depart, errorDepart} = await supabase
        .from("department")
        .select("*")
        .eq("depart_id", depart_id)
        .single();

    if (!depart || errorDepart) {
        return next(new ApiError("القسم غير موجود!", 404));
    }

    // check if the assign existing
    const {data: existingRelation} = await supabase

        .from("doctor_department")

        .select("doctor_department_id")

        .eq("doctor_id", doctor_id)

        .eq("depart_id", depart_id)

        .single();

    if (existingRelation)
        return next(new ApiError("الدكتور مرتبط بهذا القسم مسبقاً", 400));

    // assign
    const {data: assign, error} = await supabase
        .from("doctor_department")
        .insert({
            depart_id,
            doctor_id,
        })
        .select(selectStatment)
        .single();

    if (!assign || error)
        return next(new ApiError("حدث خطأ أثناء ربط الدكتور بالقسم", 400));

    await deleteByPattern("doctor-departments:*");

    assign.doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        assign.doctor.path_image,
    );

    assign.department.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DEPARTMENTS,
        assign.department.path_image,
    );

    res.status(201).json({
        status: "success",

        message: "تم ربط الدكتور بالقسم بنجاح",

        results: assign,
    });
});

// @Desc Update Doctor Department Relation
// @Route PUT : /api/doctor-departments/:id
// @Access Private (Admin)
export const updateDoctorDepartment = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {doctor_id, depart_id} = req.body;

    // Check relation
    const {data: relation, error: relationError} = await supabase

        .from("doctor_department")

        .select("doctor_deprtment_id")

        .eq("doctor_deprtment_id", id)

        .single();

    if (!relation || relationError)
        return next(new ApiError("العلاقة غير موجودة", 404));

    // Check doctor
    const {data: doctor, error: doctorError} = await supabase

        .from("doctor")

        .select("doctor_id")

        .eq("doctor_id", doctor_id)

        .single();

    if (!doctor || doctorError)
        return next(new ApiError("الدكتور غير موجود", 404));

    // Check department
    const {data: department, error: departmentError} = await supabase

        .from("department")

        .select("depart_id")

        .eq("depart_id", depart_id)

        .single();

    if (!department || departmentError)
        return next(new ApiError("القسم غير موجود", 404));

    // Check duplicate relation
    const {data: existingRelation} = await supabase

        .from("doctor_department")

        .select("doctor_deprtment_id")

        .eq("doctor_id", doctor_id)

        .eq("depart_id", depart_id)

        .neq("doctor_department_id", id)

        .single();

    if (existingRelation)
        return next(new ApiError("الدكتور مرتبط بهذا القسم مسبقاً", 400));

    // Update relation
    const {data: updatedRelation, error: updateError} = await supabase
        .from("doctor_department")
        .update({
            doctor_id,
            depart_id,
        })
        .eq("doctor_deprtment_id", id)
        .select(selectStatment)
        .single();

    if (!updatedRelation || updateError)
        return next(new ApiError("حدث خطأ أثناء تعديل العلاقة", 400));

    await deleteByPattern("doctor-departments:*");

    updatedRelation.doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        updatedRelation.doctor.path_image,
    );

    updatedRelation.department.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DEPARTMENTS,
        updatedRelation.department.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم تعديل العلاقة بنجاح",
        results: updatedRelation,
    });
});

// @Desc Delete Doctor Department Relation
// @Route Delete : /api/doctor-departments/:id
// @Access Private (Admin)
export const deleteDoctorFromDepartment = AsyncHandler(
    async (req, res, next) => {
        const {id} = req.params;

        // Check relation
        const {data: relation, error: relationError} = await supabase

            .from("doctor_department")

            .select("doctor_deprtment_id")

            .eq("doctor_deprtment_id", id)

            .single();

        if (!relation || relationError)
            return next(new ApiError("العلاقة غير موجودة", 404));

        const {data: deleteRelation, error: deleteError} = await supabase
            .from("doctor_department")
            .delete()
            .eq("doctor_deprtment_id", id)
            .select("doctor_deprtment_id")
            .single();

        if (!deleteRelation || deleteError)
            return next(new ApiError("حدث خطأ أثناء حذف العلاقة", 400));

        await deleteByPattern("doctor-departments:*");

        res.status(200).json({
            status: "success",

            message: "تم حذف العلاقة بنجاح",

            results: deleteRelation,
        });
    },
);

// @Desc Get Doctors By Department
// @Route GET : /api/doctor-departments/department/:id
// @Access Public
export const getDoctorsByDepartment = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const cacheKey = `department:${id}:doctors`;

    // Check Redis Cache
    const cachedDoctors = await getCache(cacheKey);

    if (cachedDoctors) {
        cachedDoctors.forEach((doctor) => {
            doctor.doctor.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                doctor.doctor.path_image,
            );

            doctor.department.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DEPARTMENTS,
                doctor.department.path_image,
            );
        });

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedDoctors,
        });
    }

    // Check Department
    const {data: department, error: departmentError} = await supabase
        .from("department")
        .select("depart_id")
        .eq("depart_id", id)
        .single();

    if (!department || departmentError)
        return next(new ApiError("القسم غير موجود", 404));

    // Get Doctors
    const {data: doctors, error} = await supabase
        .from("doctor_department")
        .select(selectStatment)
        .eq("depart_id", id);

    if (!doctors || error)
        return next(new ApiError("حدث خطأ أثناء جلب الدكاترة", 500));

    // Save Cache
    await setCache(cacheKey, doctors, CACHE_TTL.DOCTOR_DEPARTMENTS);

    // Replace image path with public url
    doctors.forEach((doctor) => {
        doctor.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            doctor.doctor.path_image,
        );

        doctor.department.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DEPARTMENTS,
            doctor.department.path_image,
        );
    });

    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        results: doctors,
    });
});

// @Desc Get Departments By Doctor
// @Route GET : /api/doctor-departments/doctor/:id
// @Access Public
export const getDepartmentsByDoctor = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const cacheKey = `doctor:${id}:departments`;

    // Check Redis Cache
    const cachedDepartments = await getCache(cacheKey);

    if (cachedDepartments) {
        cachedDepartments.forEach((department) => {
            department.doctor.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DOCTORS,
                department.doctor.path_image,
            );

            department.department.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DEPARTMENTS,
                department.department.path_image,
            );
        });

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedDepartments,
        });
    }

    // Check Doctor
    const {data: doctor, error: doctorError} = await supabase
        .from("doctor")
        .select("doctor_id")
        .eq("doctor_id", id)
        .single();

    if (!doctor || doctorError)
        return next(new ApiError("الدكتور غير موجود", 404));

    // Get Departments
    const {data: departments, error} = await supabase
        .from("doctor_department")
        .select(selectStatment)
        .eq("doctor_id", id);

    if (!departments || error)
        return next(new ApiError("حدث خطأ أثناء جلب الأقسام", 500));

    // Save Cache
    await setCache(cacheKey, departments, CACHE_TTL.DOCTOR_DEPARTMENTS);

    // Replace image path with public url
    departments.forEach((department) => {
        department.doctor.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DOCTORS,
            department.doctor.path_image,
        );

        department.department.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DEPARTMENTS,
            department.department.path_image,
        );
    });

    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        results: departments,
    });
});