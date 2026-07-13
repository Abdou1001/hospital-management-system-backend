import {supabase} from "../config/supabase.js";
import {redis} from "../config/redis.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";

import {STORAGE_BUCKETS} from "../config/storage.js";
import {getPublicImageUrl} from "../services/storage.service.js";
import {replaceImage} from "../services/imageUpload.service.js";

import {getCache, setCache, deleteCache} from "../services/cache.service.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";


// @Desc Get hospital information
// @Route GET : /api/hospital/
// @Access Public
export const getHospitalInfo = AsyncHandler(async (req, res, next) => {
    // Check Redis Cache
    const cachedHospital = await getCache(CACHE_KEYS.HOSPITAL);

    if (cachedHospital) {
        cachedHospital.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.HOSPITALS,
            cachedHospital.path_image,
        );

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            results: cachedHospital,
        });
    }
    
    // fetch data from database if no cache
    const {data: hospital, error} = await supabase
        .from("hospital")
        .select("*")
        .single();

    if (!hospital || error)
        return next(
            new ApiError("حدث خطأ أثناء جلب البيانات، حاول مرة أخرى", 500),
        );

    await setCache(CACHE_KEYS.HOSPITAL, hospital, CACHE_TTL.HOSPITAL);

    // Add public image url
    hospital.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.HOSPITALS,
        hospital.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        results: hospital,
    });
});

// @Desc Update hospital information
// @Route PUT : /api/hospital
// @Access Private (Admin)
export const updateHospitalInfo = AsyncHandler(async (req, res, next) => {
    const {hospital_name, location, phone_number} = req.body;

    // Get current hospital
    const {data: currentHospital, error: currentError} = await supabase
        .from("hospital")
        .select("*")
        .eq("hospital_id", 1)
        .single();

    if (!currentHospital || currentError)
        return next(new ApiError("المستشفى غير موجودة", 404));

    // Replace image & update hospital
    const hospital = await replaceImage({
        bucket: STORAGE_BUCKETS.HOSPITALS,

        currentImage: currentHospital.path_image,

        file: req.file,

        action: async (path_image) => {
            const updateData = {};

            if (hospital_name) updateData.hospital_name = hospital_name;

            if (location) updateData.location = location;

            if (phone_number) updateData.phone_number = phone_number;

            if (path_image) updateData.path_image = path_image;

            const {data, error} = await supabase
                .from("hospital")
                .update(updateData)
                .eq("hospital_id", 1)
                .select("*")
                .single();

            if (!data || error)
                throw new ApiError("حدث خطأ أثناء تحديث بيانات المستشفى", 500);

            return data;
        },
    });

    // Delete caching to update data
    await deleteCache(CACHE_KEYS.HOSPITAL);
    await deleteCache(CACHE_KEYS.DASHBOARD);

    // Add public image url
    hospital.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.HOSPITALS,
        hospital.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم تحديث بيانات المستشفى بنجاح",
        results: hospital,
    });
});
