import { supabase } from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";


// @Desc Get all departments with pagination
// @Route GET : /api/departments
// GET /api/department?page=1&limit=10&keyword=الباطنية
// @Access public
export const getDepartmentsInfo = AsyncHandler(async (req, res, next) => {
    // pageinte
    const { page, limit, from, to } = paginate(req);
    const keyword = req.query.keyword || "";


    // query
    const { data: departments, error, count } = await supabase
        .from("department")
        .select("*", { count: "exact" })
        .ilike(
            "depart_name",
            `%${keyword}%`
        )
        .range(from, to)
        .order("depart_name", { ascending: true });


    // error
    if (error)
        return next(new ApiError("حدث خطأ أثناء جلب الأقسام", 500));


    res.status(200).json({
        status: "success",
        pagination:
            paginationResult(
                page,
                limit,
                count
            ),
        results: departments
    });

});


// @Desc Get one department 
// @Route GET : /api/departments/:id
// @Access private (Admin)
export const getOneDepartmentInfo = AsyncHandler(async (req, res, next) => {
    const { id } = req.params
    // query
    const { data: department, error } = await supabase
        .from("department")
        .select("*")
        .eq("depart_id", id)
        .single()

    // error
    if (!department || error)
        return next(new ApiError("القسم غير موجود", 404));


    res.status(200).json({
        status: "success",
        results: department
    });
})


// @Desc Insert one department
// @Route POST : /api/departments/
// @Access private (Admin)
export const insertDepartment = AsyncHandler(async (req, res, next) => {
    const { depart_name, path_image } = req.body;

    const { data: department, error } = await supabase
        .from("department")
        .insert(
            {
                depart_name,
                path_image
            }
        )
        .select("*")
        .single()


    if (!department || error)
        return next(new ApiError("حدث خطاء أثناء إضافة القسم، حاول مرة اخرى", 400));


    res.status(201).json({
        status: "success",
        results: department
    });

})

// @Desc Update one department
// @Route PUT : /api/departments/:id
// @Access private (Admin)
export const updatetDepartment = AsyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { depart_name, path_image } = req.body;

    const { data: department, error } = await supabase
        .from("department")
        .update(
            {
                depart_name,
                path_image
            }
        )
        .eq("depart_id", id)
        .select("*")
        .single()


    if (error)
        return next(new ApiError("حدث خطاء أثناء تعديل القسم، حاول مرة اخرى", 400));


    res.status(200).json({
        status: "success",
        results: department
    });

})


// @Desc Delete one department
// @Route DELETE : /api/departments/:id
// @Access Private (Admin)
export const deleteDepartment = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    // Delete doctors relations
    const {
        error: relationError
    } = await supabase
        .from("doctor_department")
        .delete()
        .eq("depart_id", id);

    if (relationError)
        return next(
            new ApiError(
                "حدث خطأ أثناء حذف ارتباطات القسم",
                500
            )
        );

    // Delete department
    const {
        data: department,
        error
    } = await supabase
        .from("department")
        .delete()
        .eq("depart_id", id)
        .select("*")
        .single();

    if (!department || error)
        return next(
            new ApiError(
                "القسم غير موجود",
                404
            )
        );

    res.status(200).json({
        status: "success",
        message: "تم حذف القسم بنجاح",
        results: department
    });

});