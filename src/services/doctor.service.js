import {supabase} from "../config/supabase.js";
import ApiError from "../utils/ApiError.js";

// For create
export const createDoctorWithRelations = async ({
    doctor,
    pathImage,
    departmentIds = [],
    schedules = [],
}) => {
    // إرسال العملية كاملة إلى PostgreSQL
    const {data, error} = await supabase.rpc("create_doctor_with_relations", {
        // بيانات الطبيب
        p_doctor: doctor,

        // مسار الصورة الموجودة في Storage
        p_path_image: pathImage,

        // أقسام الطبيب
        p_department_ids: departmentIds,

        // أوقات دوام الطبيب
        p_schedules: schedules,
    });

    // إذا فشل الـ RPC
    if (error) {
        console.error("createDoctorWithRelations RPC error:", error);

        throw new ApiError(error.message || "حدث خطأ أثناء إضافة الطبيب", 400);
    }

    // إعادة الطبيب الذي أنشأته PostgreSQL
    return data;
};

// For update
export const updateDoctorWithRelations = async ({
    doctorId,
    doctor,
    pathImage,
    departmentIds,
    schedules,
}) => {
    const {data, error} = await supabase.rpc("update_doctor_with_relations", {
        p_doctor_id: doctorId,
        p_doctor: doctor,
        p_path_image: pathImage,
        p_department_ids: departmentIds,
        p_schedules: schedules,
    });

    if (error) {
        console.error("updateDoctorWithRelations RPC error:", error);

        throw new ApiError(error.message || "حدث خطأ أثناء تعديل الطبيب", 400);
    }

    return data;
};