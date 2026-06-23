import { supabase } from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";


const selectStatment = `doctor_deprtment_id,doctor (doctor_id,full_name,path_image),department (depart_id,depart_name,path_image)`

// @Desc Get all Doctor Departments Relations
// @Route GET : /api/doctor-departments
// Examples:
// GET /api/doctor-departments
// GET /api/doctor-departments?keyword=احمد
// GET /api/doctor-departments?keyword=قلب
// @Access Private (Admin)

export const getDoctorDepartmentsInfo = AsyncHandler(async (req, res, next) => {

    // Pagination
    const { page, limit, from, to } = paginate(req);

    // Filters
    const {
        keyword = "",
        sort = "doctor_deprtment_id"
    } = req.query;

    // Base Query
    let query = supabase

        .from("doctor_department")

        .select(selectStatment, {
            count: "exact"
        });


    // Search by doctor name or department name
    if (keyword) {

        const { data: doctors } = await supabase

            .from("doctor")

            .select("doctor_id")

            .ilike(
                "full_name",
                `%${keyword}%`
            );


        const { data: departments } = await supabase

            .from("department")

            .select("depart_id")

            .ilike(
                "depart_name",
                `%${keyword}%`
            );


        const doctorIds =
            doctors?.map(
                doctor => doctor.doctor_id
            ) || [];


        const departmentIds =
            departments?.map(
                department => department.depart_id
            ) || [];


        // If there is no result
        if (
            doctorIds.length === 0 &&
            departmentIds.length === 0
        ) {

            return res.status(200).json({

                status: "success",

                pagination:
                    paginationResult(
                        page,
                        limit,
                        0
                    ),

                results: []

            });

        }


        const conditions = [];

        if (doctorIds.length > 0)

            conditions.push(
                `doctor_id.in.(${doctorIds.join(",")})`
            );


        if (departmentIds.length > 0)

            conditions.push(
                `depart_id.in.(${departmentIds.join(",")})`
            );


        query = query.or(
            conditions.join(",")
        );

    }


    // Sorting
    query = query.order(
        sort,
        {
            ascending: true
        }
    );


    // Execute Query
    const {
        data: relations,
        error,
        count
    } = await query.range(
        from,
        to
    );

    console.log(error)
    // Error
    if (!relations || error)

        return next(
            new ApiError(
                "حدث خطأ أثناء جلب البيانات",
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

        results:
            relations

    });

});


// @Desc Assign Doctor To Department
// @Route POST : /api/doctor-departments
// @Access Private (Admin)
export const assignDoctorToDepartment = AsyncHandler(async (req, res, next) => {
    const { doctor_id, depart_id } = req.body

    // Check if there doctor with this id
    const { data: doctor, errorDoctors } = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", doctor_id)
        .single()

    if (!doctor || errorDoctors) {
        return next(new ApiError("الدكتور الذي اضفته غير موجود!", 404))
    }

    // Check if there department with this id
    const { data: depart, errorDepart } = await supabase
        .from("department")
        .select("*")
        .eq("depart_id", depart_id)
        .single()

    if (!depart || errorDepart) {
        return next(new ApiError("القسم غير موجود!", 404))
    }

    // check if the assign existing
    const { data: existingRelation } = await supabase

        .from("doctor_department")

        .select("doctor_department_id")

        .eq("doctor_id", doctor_id)

        .eq("depart_id", depart_id)

        .single();


    if (existingRelation)

        return next(
            new ApiError(
                "الدكتور مرتبط بهذا القسم مسبقاً",
                400
            )
        );

    // assign
    const { data: assign, error } = await supabase
        .from("doctor_department")
        .insert({
            depart_id,
            doctor_id
        })
        .select(selectStatment)
        .single()

    if (!assign || error)

        return next(
            new ApiError(
                "حدث خطأ أثناء ربط الدكتور بالقسم",
                400
            )
        );


    res.status(201).json({

        status: "success",

        message:
            "تم ربط الدكتور بالقسم بنجاح",

        results:
            assign

    });
})