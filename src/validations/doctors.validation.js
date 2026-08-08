import { z } from "zod";
import { supabase } from "../config/supabase.js";

/* =========================
   Insert Doctor Validation
========================= */

export const insertDoctorSchema = z
    .object({
        full_name: z
            .string( "اسم الدكتور مطلوب")
            .min(3, "اسم الدكتور قصير جدًا")
            .max(50, "اسم الدكتور طويل جدًا"),

        email: z
            .union([
                z.literal(""),
                z.string().email("البريد الإلكتروني غير صالح").trim(),
            ])
            .optional(),

        bio: z
            .string("الوصف مطلوب")
            .min(10, "الوصف قصير جدًا")
            .max(1000, "الوصف طويل جدًا"),

        education: z
            .string("المؤهل العلمي مطلوب")
            .min(3, "المؤهل العلمي قصير جدًا")
            .max(100, "المؤهل العلمي طويل جدًا"),

        gender: z.enum(["ذكر", "أنثى"], {
            error: () => ({
                message: "الجنس غير صالح",
            }),
        }),

        years_exper: z.coerce
            .number("سنوات الخبرة مطلوبة")
            .min(0, "سنوات الخبرة غير صالحة")
            .max(60, "سنوات الخبرة غير صالحة"),

        phone_number: z
            .string()
            .trim()
            .min(7, "رقم الهاتف غير صالح")
            .max(20)
            .optional(),

        notes: z.string().max(500, "الملاحظات طويلة جدًا").optional(),

        consultation_fee: z.coerce
            .number("سعر الاستشارة مطلوب")
            .positive("سعر الاستشارة غير صالح"),
    })

    .superRefine(async (data, ctx) => {
        if (!data.email) return;

        const {data: doctor} = await supabase
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

export const updateDoctorSchema = z
    .object({
        full_name: z
            .string()
            .min(3, "اسم الدكتور قصير جدًا")
            .max(100, "اسم الدكتور طويل جدًا")
            .optional(),

        email: z
            .union([
                z.literal(""),
                z.string().email("البريد الإلكتروني غير صالح").trim(),
            ])
            .optional(),

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

        gender: z.enum(["ذكر", "أنثى"], {
            error: () => ({
                message: "الجنس غير صالح",
            }),
        }),

        years_exper: z.coerce
            .number()
            .min(0, "سنوات الخبرة غير صالحة")
            .max(60, "سنوات الخبرة غير صالحة")
            .optional(),

        phone_number: z
            .string()
            .trim()
            .min(6, "رقم الهاتف غير صالح")
            .max(20)
            .optional(),

        notes: z.string().max(500, "الملاحظات طويلة جدًا").optional(),

        consultation_fee: z.coerce
            .number()
            .min(1000)
            .max(50000)
            .positive("سعر الاستشارة غير صالح"),
    })

    .refine(
        (data) => Object.keys(data).length > 0,

        {
            message: "يجب إرسال حقل واحد على الأقل للتعديل",
        },
    );
