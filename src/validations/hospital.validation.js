import { z } from "zod";

/* =========================
   Update Hospital Validation
========================= */

export const updateHospitalInfoSchema = z.object({

    hospital_name: z
        .string()
        .min(3, "اسم المستشفى قصير جدًا")
        .optional(),

    location: z
        .string()
        .min(3, "الموقع غير صالح"),

    phone_number: z
        .string()
        .min(6, "رقم الهاتف غير صالح"),

    path_image: z
        .string()
        .url("رابط الصورة غير صالح"),

}).refine(
    (data) =>
        Object.keys(data).length > 0,

    {
        message:
            "يجب إرسال حقل واحد على الأقل للتعديل",
    }
);