import { supabase } from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";


// @Desc Get hospital information
// @Route GET : /api/hospital/
// @Access Public
export const getHospitalInfo = AsyncHandler(async (req, res, next) => {
    const { data: hospital, error } = await supabase
        .from("hospital")
        .select("*")
        .single()

    if (!hospital || error)
        return next(new ApiError("حدث خطأ أثناء جلب البيانات، حاول مرة أخرى", 500))

    res.status(200).json({
        status: "success",
        message: "تم جلب البيانات بنجاح",
        results: hospital
    });
})


// @Desc Update hospital information
// @Route PUT : /api/hospital
// @Access Private (Admin)
export const updateHospitalInfo = AsyncHandler(async (req, res, next) => {
    const { hospital_name, location, phone_number, path_image } = req.body;

    const updateData = {};

    if (hospital_name)
        updateData.hospital_name = hospital_name;

    if (location)
        updateData.location = location;

    if (phone_number)
        updateData.phone_number = phone_number;

    if (path_image)
        updateData.path_image = path_image;

    const { data: hospital, error } = await supabase
        .from("hospital")
        .update(updateData)
        .eq("hospital_id", 1)
        .select("*")
        .single();

    if (!hospital || error)
        return next(
            new ApiError(
                "حدث خطأ أثناء تحديث بيانات المستشفى",
                500
            )
        );

    res.status(200).json({
        status: "success",
        message: "تم تحديث بيانات المستشفى بنجاح",
        results: hospital
    });
});


