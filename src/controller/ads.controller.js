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

// @Desc Get all ads with pagination, filters and sorting
// @Route GET : /api/ads
// Examples:
// GET /api/ads?page=1&limit=10
// GET /api/ads?status=active
// GET /api/ads?expired=true
// GET /api/ads?sort=-created_at
// @Access Public
export const getAdsInfo = AsyncHandler(async (req, res, next) => {
    // Pagination
    const { page, limit, from, to } = paginate(req);

    // Filters
    const { status, expired, sort = "-created_at" } = req.query;

    const today = new Date().toISOString().split("T")[0];

    // Base Query
    let query = supabase
        .from("ads")
        .select("*", { count: "exact" });

    // Filter by status
    if (status) {
        query = query.eq("status", status);
    }

    // Filter expired ads
    if (expired === "true") {
        query = query.lt("end_date", today);
    }

    // Filter active ads
    if (expired === "false") {
        query = query.gte("end_date", today);
    }

    // Sorting
    query = query.order(
        sort.startsWith("-") ? sort.substring(1) : sort,
        {
            ascending: !sort.startsWith("-"),
        }
    );

    // Execute Query
    const { data: ads, error, count } = await query.range(from, to);

    if (!ads || error) {
        return next(new ApiError("حدث خطأ أثناء جلب الإعلانات", 500));
    }

    // Add public image url
    ads.forEach((ad) => {
        ad.image_url = getPublicImageUrl(STORAGE_BUCKETS.ADS, ad.path_image);
    });

    res.status(200).json({
        status: "success",
        message: "تم جلب الإعلانات بنجاح",
        pagination: paginationResult(page, limit, count),
        results: ads,
    });
});

// @Desc Get one ad
// @Route GET : /api/ads/:id
// @Access Public
export const getOneAdInfo = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {data: ad, error} = await supabase
        .from("ads")
        .select("*")
        .eq("ad_id", id)
        .single();

    if (!ad || error) {
        return next(new ApiError("الإعلان غير موجود", 404));
    }

    // Add public image url
    ad.image_url = getPublicImageUrl(STORAGE_BUCKETS.ADS, ad.path_image);

    res.status(200).json({
        status: "success",
        message: "تم جلب الإعلان بنجاح",
        results: ad,
    });
});

// @Desc Insert New Ad
// @Route POST : /api/ads
// @Access Private (Admin)
export const insertAd = AsyncHandler(async (req, res, next) => {
    const { start_date, end_date } = req.body;

    let path_image = null;

    try {
        // Upload image
        path_image = await uploadAndProcessImage(STORAGE_BUCKETS.ADS, req.file);

        // Create advertisement
        const { data: ad, error } = await supabase
            .from("ads")
            .insert({
                path_image,
                start_date,
                end_date,
                created_at: new Date(),
                status: "active",
            })
            .select("*")
            .single();

        if (error) {
            throw new ApiError("حدث خطأ أثناء إضافة الإعلان", 400);
        }

        // Add public image url
        ad.image_url = getPublicImageUrl(STORAGE_BUCKETS.ADS, ad.path_image);

        // Response
        res.status(201).json({
            status: "success",
            message: "تم إضافة الإعلان بنجاح",
            results: ad,
        });
    } catch (err) {
        // Delete uploaded image if database failed
        await rollbackUploadedImage(STORAGE_BUCKETS.ADS, path_image);

        return next(err);
    }
});

// @Desc Update one ad
// @Route PUT : /api/ads/:id
// @Access Private (Admin)
export const updateAd = AsyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const { start_date, end_date, status } = req.body;

    // Get current advertisement
    const { data: currentAd, error: currentError } = await supabase
        .from("ads")
        .select("*")
        .eq("ad_id", id)
        .single();

    if (!currentAd || currentError) {
        return next(new ApiError("الإعلان غير موجود", 404));
    }

    // Replace image & update advertisement
    const ad = await replaceImage({
        bucket: STORAGE_BUCKETS.ADS,

        currentImage: currentAd.path_image,

        file: req.file,

        action: async (path_image) => {
            const { data, error } = await supabase
                .from("ads")
                .update({
                    path_image,
                    start_date,
                    end_date,
                    status,
                })
                .eq("ad_id", id)
                .select("*")
                .single();

            if (!data || error) {
                throw new ApiError("حدث خطأ أثناء تعديل الإعلان", 400);
            }

            return data;
        },
    });

    // Add public image url
    ad.image_url = getPublicImageUrl(STORAGE_BUCKETS.ADS, ad.path_image);

    // Response
    res.status(200).json({
        status: "success",
        message: "تم تعديل الإعلان بنجاح",
        results: ad,
    });
});

// @Desc Delete one ad
// @Route DELETE : /api/ads/:id
// @Access Private (Admin)
export const deleteAd = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {data: ad, error} = await supabase
        .from("ads")
        .select("path_image")
        .eq("ad_id", id)
        .single();

    if (!ad || error) {
        return next(new ApiError("الإعلان غير موجود", 404));
    }

    const {error: errorDelete} = await supabase
        .from("ads")
        .delete()
        .eq("ad_id", id);

    if (errorDelete) {
        return next(new ApiError("فشل حذف الإعلان", 500));
    }

    await deleteImage(STORAGE_BUCKETS.ADS, ad.path_image);

    res.status(200).json({
        status: "success",
        message: "تم حذف الإعلان بنجاح",
    });
});

// @Desc Toggle ad status
// @Route PATCH : /api/ads/:id/toggle-status
// @Access Private (Admin)
export const toggleAdStatus = AsyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // Get current advertisement
    const { data: ad, error } = await supabase
        .from("ads")
        .select("ad_id, status")
        .eq("ad_id", id)
        .single();

    if (!ad || error) {
        return next(new ApiError("الإعلان غير موجود", 404));
    }

    // Toggle status
    const newStatus =
        ad.status === "active" ? "inactive" : "active";

    // Update status
    const { data: updatedAd, error: updateError } = await supabase
        .from("ads")
        .update({
            status: newStatus,
        })
        .eq("ad_id", id)
        .select("*")
        .single();

    if (!updatedAd || updateError) {
        return next(new ApiError("حدث خطأ أثناء تغيير حالة الإعلان", 400));
    }

    // Add image url
    updatedAd.image_url = getPublicImageUrl(
        STORAGE_BUCKETS.ADS,
        updatedAd.path_image
    );

    res.status(200).json({
        status: "success",
        message: `تم ${newStatus === "active" ? "تفعيل" : "إيقاف"} الإعلان بنجاح`,
        results: updatedAd,
    });
});