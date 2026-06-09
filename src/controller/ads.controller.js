import { supabase } from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";


// @Desc Get all ads with pagination, search, filters and sorting
// @Route GET : /api/ads
// Examples:
// GET /api/ads?page=1&limit=10
// GET /api/ads?keyword=خصم
// GET /api/ads?status=active
// GET /api/ads?expired=true
// GET /api/ads?sort=-created_at
// @Access Public
export const getAdsInfo = AsyncHandler(async (req, res, next) => {

    // Pagination
    const { page, limit, from, to } = paginate(req);

    // Filters
    const {
        keyword = "",
        status,
        expired,
        sort = "-created_at"
    } = req.query;

    const today = new Date()
        .toISOString()
        .split("T")[0];

    // Base Query
    let query = supabase
        .from("ads")
        .select("*", {
            count: "exact"
        })
        .ilike(
            "title",
            `%${keyword}%`
        );

    // Filter by status
    if (status)
        query = query.eq(
            "status",
            status
        );

    // Filter expired ads
    if (expired === "true")
        query = query.lt(
            "end_date",
            today
        );

    // Filter active ads
    if (expired === "false")
        query = query.gte(
            "end_date",
            today
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
    const { data: ads, error, count } = await query
        .range(from, to);

    // Error
    if (!ads || error)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب الإعلانات",
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

        results: ads

    });

});

// @Desc Get one ad
// @Route GET : /api/ads/:id
// @Access Public
export const getOneAdInfo = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const { data: ad, error } = await supabase
        .from("ads")
        .select("*")
        .eq(
            "ad_id",
            id
        )
        .single();

    if (!ad || error)
        return next(
            new ApiError(
                "الإعلان غير موجود",
                404
            )
        );

    res.status(200).json({
        status: "success",
        results: ad
    });

});


// @Desc Insert one ad
// @Route POST : /api/ads
// @Access Private (Admin)
export const insertAd = AsyncHandler(async (req, res, next) => {

    const {
        title,
        description,
        path_image,
        start_date,
        end_date
    } = req.body;

    const { data: ad, error } = await supabase
        .from("ads")
        .insert({
            title,
            description,
            path_image,

            created_at:
                new Date(),

            start_date,
            end_date,

            status:
                "active"
        })
        .select("*")
        .single();

    if (error)
        return next(
            new ApiError(
                "حدث خطأ أثناء إضافة الإعلان",
                400
            )
        );

    res.status(201).json({
        status: "success",
        results: ad
    });

});


// @Desc Update one ad
// @Route PUT : /api/ads/:id
// @Access Private (Admin)
export const updateAd = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const {
        title,
        description,
        path_image,
        start_date,
        end_date,
        status
    } = req.body;

    const { data: ad, error } = await supabase
        .from("ads")
        .update({
            title,
            description,
            path_image,
            start_date,
            end_date,
            status
        })
        .eq(
            "ad_id",
            id
        )
        .select("*")
        .single();

    if (!ad || error)
        return next(
            new ApiError(
                "حدث خطأ أثناء تعديل الإعلان",
                400
            )
        );

    res.status(200).json({
        status: "success",
        results: ad
    });

});


// @Desc Delete one ad
// @Route DELETE : /api/ads/:id
// @Access Private (Admin)
export const deleteAd = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const { data: ad, error } = await supabase
        .from("ads")
        .delete()
        .eq(
            "ad_id",
            id
        )
        .select("*")
        .single();

    if (!ad || error)
        return next(
            new ApiError(
                "الإعلان غير موجود",
                404
            )
        );

    res.status(200).json({
        status: "success",
        message:
            "تم حذف الإعلان بنجاح",
        results: ad
    });

});