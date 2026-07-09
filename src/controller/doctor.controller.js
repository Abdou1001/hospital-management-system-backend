import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";
import {getPublicImageUrl} from "../services/storage.service.js";
import {STORAGE_BUCKETS} from "../config/storage.js";
import { replaceImage, rollbackUploadedImage, uploadAndProcessImage } from "../services/imageUpload.service.js";

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

    // fliters
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

    // Base Query
    let query = supabase
        .from("doctor")
        .select("*", {
            count: "exact",
        })
        // search
        .or(
            `full_name.ilike.%${keyword}%,bio.ilike.%${keyword}%,education.ilike.%${keyword}%`,
        );

    // Filter by status
    if (status) query = query.eq("status", status);

    // Filter by gender
    if (gender) query = query.eq("gender", gender);

    // Filter by minimum years experience
    if (min_experience) query = query.gte("years_experience", min_experience);

    // Filter by maximum years experience
    if (max_experience) query = query.lte("years_experience", max_experience);

    // Filter by minimum consultation fee
    if (min_fee) query = query.gte("consultation_fee", min_fee);

    // Filter by maximum consultation fee
    if (max_fee) query = query.lte("consultation_fee", max_fee);

    // Sorting Descending
    if (sort.startsWith("-")) {
        query = query.order(sort.substring(1), {
            ascending: false,
        });
    }
    // Sorting Ascending
    else {
        query = query.order(sort, {
            ascending: true,
        });
    }

    // Execute Query
    const {data: doctors, error, count} = await query.range(from, to);

    // Handle Error
    if (error || !doctors)
        return next(new ApiError("حدث خطأ أثناء جلب الاطباء", 500));

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
        message: "تم جلب الطباء بنجاح",

        pagination: paginationResult(page, limit, count),
        results: doctors,
    });
});

// @Desc Get one Doctor
// @Route GET : /api/doctors/:id
// @Access Public
export const getOneDoctorInfo = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    // query
    const {data: doctor, error} = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single();

    // error
    if (!doctor || error)
        return next(
            new ApiError("حدث خطاء في جلب الاطبيب، حاول مرة اخرى", 404),
        );

    doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        doctor.path_image,
    );

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


    doctor.path_image = getPublicImageUrl(
        STORAGE_BUCKETS.DOCTORS,
        doctor.path_image,
    );

    res.status(200).json({
        status: "success",
        message: "تم اخفاء الطبيب بنجاح",
        results: updatedDoctor,
    });
});
