import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
// for upload image
import {deleteImage, getPublicImageUrl} from "../services/storage.service.js";
import {STORAGE_BUCKETS} from "../config/storage.js";
import {
    replaceImage,
    rollbackUploadedImage,
    uploadAndProcessImage,
} from "../services/imageUpload.service.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";
import {deleteByPattern, deleteCache, getCache, setCache} from "../services/cache.service.js";

// @Desc Get all departments with pagination
// @Route GET : /api/departments
// GET /api/departments?page=1&limit=10&keyword=الباطنية&sort=most_doctors
// GET /api/departments?page=1&limit=10&keyword=الباطنية&sort=least_doctors
// @Access Public
export const getDepartmentsInfo = AsyncHandler(async (req, res, next) => {
    // Pagination
    const { page, limit, from, to } = paginate(req);

    const keyword = req.query.keyword || "";
    const sort = req.query.sort || "name";

    // Cache Key
    const cacheKey = `departments:page=${page}:limit=${limit}:keyword=${keyword}:sort=${sort}`;

    // Check Redis Cache
    const cachedDepartments = await getCache(cacheKey);

    if (cachedDepartments) {
        cachedDepartments.results.forEach((department) => {
            department.path_image = getPublicImageUrl(
                STORAGE_BUCKETS.DEPARTMENTS,
                department.path_image,
            );
        });

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            pagination: cachedDepartments.pagination,
            results: cachedDepartments.results,
        });
    }

    // Query
    let query = supabase
        .from("department")
        .select(
            `
        *,
        doctor_department(count)
    `,
            {count: "exact"},
        )
        .ilike("depart_name", `%${keyword}%`);


    const { data: departments, error, count } = await query.range(from, to);

    if (error)
        return next(new ApiError("حدث خطأ أثناء جلب الأقسام", 500));

    // تجهيز عدد الأطباء
    departments.forEach((department) => {
        department.doctors_count =
            department.doctor_department?.[0]?.count || 0;

        delete department.doctor_department;
    });

    switch (sort) {
        case "most_doctors":
            departments.sort((a, b) => b.doctors_count - a.doctors_count);
            break;

        case "least_doctors":
            departments.sort((a, b) => a.doctors_count - b.doctors_count);
            break;

        default:
            departments.sort((a, b) =>
                a.depart_name.localeCompare(b.depart_name, "ar"),
            );
    }

    // Pagination
    const pagination = paginationResult(page, limit, count);


    const results = departments.map((department) => ({
        ...department,
        path_image: getPublicImageUrl(
            STORAGE_BUCKETS.DEPARTMENTS,
            department.path_image,
        ),
    }));

    // Save Cache
    await setCache(
        cacheKey,
        {
            pagination,
            results: departments,
        },
        CACHE_TTL.DEPARTMENTS,
    );

    res.status(200).json({
        status: "success",
        message: "تم جلب الأقسام بنجاح",
        pagination,
        results
    });
});

// @Desc Get department
// @Route GET : /api/department
// @Access Public
export const getOneDepartmentInfo = AsyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const cacheKey = CACHE_KEYS.DEPARTMENT(id);

    // Check Redis Cache
    const cachedDepartment = await getCache(cacheKey);

    if (cachedDepartment) {
        cachedDepartment.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DEPARTMENTS,
            cachedDepartment.path_image,
        );

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedDepartment,
        });
    }

    // Query
    const { data: department, error } = await supabase
        .from("department")
        .select("*")
        .eq("depart_id", id)
        .single();

    if (!department || error)
        return next(new ApiError("القسم غير موجود", 404));

    // Save Cache
    await setCache(
        cacheKey,
        department,
        CACHE_TTL.DEPARTMENTS,
    );

    // Add public image url
    department.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DEPARTMENTS,
        department.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم جلب القسم بنجاح",
        results: department,
    });
});

// @Desc Insert one department
// @Route POST : /api/departments/
// @Access private (Admin)
export const insertDepartment = AsyncHandler(async (req, res, next) => {
    const {depart_name} = req.body;

    let path_image = null;

    try {
        // Upload image
        path_image = await uploadAndProcessImage(
            STORAGE_BUCKETS.DEPARTMENTS,
            req.file,
        );

        const {data: department, error} = await supabase
            .from("department")
            .insert({
                depart_name,
                path_image,
            })
            .select("*")
            .single();

        if (!department || error)
            throw new ApiError(
                "حدث خطاء أثناء إضافة القسم، حاول مرة اخرى",
                400,
            );

        // Delete caching to update data
        await deleteByPattern("departments:*");
        await deleteCache(CACHE_KEYS.DASHBOARD);

        // Add public image url
        department.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.DEPARTMENTS,
            department.path_image,
        );

        res.status(201).json({
            status: "success",
            message: "تم اضافة القسم بنجاح",
            results: department,
        });
    } catch (err) {
        await rollbackUploadedImage(STORAGE_BUCKETS.DEPARTMENTS, path_image);

        return next(err);
    }
});

// @Desc Update one department
// @Route PUT : /api/departments/:id
// @Access private (Admin)
export const updatetDepartment = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {depart_name} = req.body;

    // Get current department
    const {data: currentDepartment, error: currentError} = await supabase
        .from("department")
        .select("*")
        .eq("depart_id", id)
        .single();

    if (!currentDepartment || currentError)
        return next(new ApiError("القسم غير موجود", 404));

    // Check duplicate department name
    if (depart_name) {
        const {data: department} = await supabase
            .from("department")
            .select("depart_id")
            .eq("depart_name", depart_name)
            .neq("depart_id", id)
            .single();

        if (department) {
            return next(new ApiError("اسم القسم موجود بالفعل", 400));
        }
    }

    // Replace image & update department
    const department = await replaceImage({
        bucket: STORAGE_BUCKETS.DEPARTMENTS,

        currentImage: currentDepartment.path_image,

        file: req.file,

        action: async (path_image) => {
            const {data, error} = await supabase
                .from("department")
                .update({
                    depart_name,
                    path_image,
                })
                .eq("depart_id", id)
                .select("*")
                .single();

            if (!data || error)
                throw new ApiError(
                    "حدث خطاء أثناء تعديل القسم، حاول مرة اخرى",
                    400,
                );

            return data;
        },
    });

    // Delete caching to update data
    await deleteByPattern("departments:*");
    await deleteCache(CACHE_KEYS.DEPARTMENT(id));
    await deleteCache(CACHE_KEYS.DASHBOARD);

    // Add public image url
    department.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DEPARTMENTS,
        department.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم تعديل القسم بنجاح",
        results: department,
    });
});

// @Desc Delete one department
// @Route DELETE : /api/departments/:id
// @Access Private (Admin)
export const deleteDepartment = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    // Delete doctors relations
    const {error: relationError} = await supabase
        .from("doctor_department")
        .delete()
        .eq("depart_id", id);

    if (relationError)
        return next(new ApiError("حدث خطأ أثناء حذف ارتباطات القسم", 500));

    // Delete department
    const {data: department, error} = await supabase
        .from("department")
        .delete()
        .eq("depart_id", id)
        .select("*")
        .single();

    if (!department || error) return next(new ApiError("القسم غير موجود", 404));

    await deleteImage(STORAGE_BUCKETS.DEPARTMENTS, department.path_image);

    // Delete caching to update data
    await deleteByPattern("departments:*");
    await deleteCache(CACHE_KEYS.DASHBOARD);

    res.status(200).json({
        status: "success",
        message: "تم حذف القسم بنجاح",
        results: department,
    });
});