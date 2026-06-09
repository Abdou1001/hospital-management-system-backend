import { supabase } from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";


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
    const { page, limit, from, to } = paginate(req);

    // fliters
    const {
        keyword = "",
        status,
        gender,
        min_experience,
        max_experience,
        min_fee,
        max_fee,
        sort = "full_name"
    } = req.query;

    // Base Query
    let query = supabase
        .from("doctor")
        .select("*", {
            count: "exact"
        })
        // search
        .or(
            `full_name.ilike.%${keyword}%,bio.ilike.%${keyword}%,education.ilike.%${keyword}%`
        )

    // Filter by status
    if (status)
        query = query.eq(
            "status",
            status
        );

    // Filter by gender
    if (gender)
        query = query.eq(
            "gender",
            gender
        );


    // Filter by minimum years experience
    if (min_experience)
        query = query.gte(
            "years_experience",
            min_experience
        );


    // Filter by maximum years experience
    if (max_experience)
        query = query.lte(
            "years_experience",
            max_experience
        );


    // Filter by minimum consultation fee
    if (min_fee)
        query = query.gte(
            "consultation_fee",
            min_fee
        );


    // Filter by maximum consultation fee
    if (max_fee)
        query = query.lte(
            "consultation_fee",
            max_fee
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
    const { data: doctors, error, count } = await query.range(from, to);


    // Handle Error
    if (error || !doctors)
        return next(new ApiError("حدث خطأ أثناء جلب الدكاترة", 500));


    // Response
    res.status(200).json({

        status: "success",

        pagination: paginationResult(page, limit, count),
        results: doctors,

    });

});


// @Desc Get one Doctor
// @Route GET : /api/doctors/:id
// @Access Public
export const getOneDoctorInfo = AsyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // query
    const { data: doctor, error } = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single()

    // error
    if (!doctor || error)
        return next(new ApiError("حدث خطاء في جلب البيانات، حاول مرة اخرى", 404));


    res.status(200).json({
        status: "success",
        results: doctor
    });
})


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
        path_image,
        notes,
        consultation_fee,

    } = req.body;

    const { data: doctor, error } = await supabase
        .from("doctor")
        .insert(
            {
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
            }
        )
        .select("*")
        .single()


    if (error)
        return next(new ApiError("حدث خطاء أثناء إضافة الطبيب، حاول مرة اخرى", 400));


    res.status(201).json({
        status: "success",
        results: doctor
    });
})


// @Desc Update one doctor
// @Route PUT : /api/doctors/:id
// @Access Private (Admin)
export const updateDoctor = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const {
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
    } = req.body;

    const { data: doctor, error } = await supabase
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


    if (!doctor || error)
        return next(
            new ApiError(
                "حدث خطأ أثناء تعديل بيانات الطبيب",
                400
            )
        );


    res.status(200).json({
        status: "success",
        results: doctor
    });

});


// @Desc Toggle doctor booking status
// @Route PATCH : /api/doctors/:id/status
// @Access Private (Admin)
export const changeDoctorStatus = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const { data: doctor, error } = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single();

    if (!doctor || error)
        return next(
            new ApiError(
                "الطبيب غير موجود",
                404
            )
        );

    const { data: updatedDoctor } = await supabase
        .from("doctor")
        .update({
            status:
                doctor.status === "active"
                    ? "inactive"
                    : "active"
        })
        .eq("doctor_id", id)
        .select("*")
        .single();

    res.status(200).json({
        status: "success",
        results: updatedDoctor
    });

});


// @Desc Show or hide doctor
// @Route PATCH : /api/doctors/:id/is_hidden
// @Access Private (Admin)
export const toggleDoctorVisibility = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const { data: doctor, error } = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single();

    if (!doctor || error)
        return next(
            new ApiError(
                "الطبيب غير موجود",
                404
            )
        );

    const { data: updatedDoctor } = await supabase
        .from("doctor")
        .update({
            is_hidden: !doctor.hide
        })
        .eq("doctor_id", id)
        .select("*")
        .single();

    res.status(200).json({
        status: "success",
        results: updatedDoctor
    });

});