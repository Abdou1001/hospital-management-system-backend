import { z } from "zod";
import { supabase } from "../config/supabase.js";

/* =========================
   Insert Doctor Validation
========================= */

export const insertDoctorSchema = z.object({

    full_name: z
        .string({
            required_error: "اسم الدكتور مطلوب",
        })
        .min(3, "اسم الدكتور قصير جدًا")
        .max(50, "اسم الدكتور طويل جدًا"),

    email: z
        .string()
        .trim()
        .email("البريد الإلكتروني غير صالح")
        .optional()
        .or(z.literal("")),

    bio: z
        .string({
            required_error: "الوصف مطلوب",
        })
        .min(10, "الوصف قصير جدًا")
        .max(1000, "الوصف طويل جدًا"),

    education: z
        .string({
            required_error: "المؤهل العلمي مطلوب",
        })
        .min(3, "المؤهل العلمي قصير جدًا")
        .max(100, "المؤهل العلمي طويل جدًا"),

    gender: z.enum(
        ["male", "female"],
        {
            errorMap: () => ({
                message: "الجنس غير صالح",
            }),
        }
    ),

    years_exper: z.coerce
        .number({
            required_error: "سنوات الخبرة مطلوبة",
        })
        .min(0, "سنوات الخبرة غير صالحة")
        .max(60, "سنوات الخبرة غير صالحة"),

    phone_number: z
        .string()
        .min(6, "رقم الهاتف غير صالح")
        .max(15, "رقم الهاتف غير صالح")
        .optional(),

    path_image: z
        .string({
            required_error: "صورة الدكتور مطلوبة",
        }),

    notes: z
        .string()
        .max(500, "الملاحظات طويلة جدًا")
        .optional(),

    consultation_fee: z.coerce
        .number({
            required_error: "سعر الاستشارة مطلوب",
        })
        .positive("سعر الاستشارة غير صالح"),

})

    .superRefine(async (data, ctx) => {

        if (!data.email)
            return;

        const { data: doctor } = await supabase
            .from("doctor")
            .select("doctor_id")
            .eq("email", data.email);

        if (doctor && doctor.length > 0) {

            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["email"],
                message: "البريد الإلكتروني مستخدم بالفعل",
            });

        }

    });





/* =========================
   Update Doctor Validation
========================= */

export const updateDoctorSchema = z.object({

    full_name: z
        .string()
        .min(3, "اسم الدكتور قصير جدًا")
        .max(50, "اسم الدكتور طويل جدًا")
        .optional(),

    email: z
        .string()
        .trim()
        .email("البريد الإلكتروني غير صالح")
        .optional()
        .or(z.literal("")),

    bio: z
        .string()
        .min(10, "الوصف قصير جدًا")
        .max(1000, "الوصف طويل جدًا")
        .optional(),

    education: z
        .string()
        .min(3, "المؤهل العلمي قصير جدًا")
        .max(100, "المؤهل العلمي طويل جدًا")
        .optional(),

    gender: z
        .enum([
            "male",
            "female"
        ])
        .optional(),

    years_exper: z.coerce
        .number()
        .min(0, "سنوات الخبرة غير صالحة")
        .max(60, "سنوات الخبرة غير صالحة")
        .optional(),

    phone_number: z
        .string()
        .min(6, "رقم الهاتف غير صالح")
        .max(15, "رقم الهاتف غير صالح")
        .optional(),

    path_image: z
        .string()
        .optional(),

    notes: z
        .string()
        .max(500, "الملاحظات طويلة جدًا")
        .optional(),

    status: z
        .enum([
            "active",
            "inactive"
        ])
        .optional(),

    consultation_fee: z.coerce
        .number()
        .positive("سعر الاستشارة غير صالح")
        .optional(),

})

    .refine(
        (data) =>
            Object.keys(data).length > 0,

        {
            message:
                "يجب إرسال حقل واحد على الأقل للتعديل",
        }
    );
