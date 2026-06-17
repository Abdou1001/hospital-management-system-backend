import { z } from "zod";
import { supabase } from "../config/supabase.js";

/* =========================
   Insert Appointment Validation
========================= */

export const insertAppointmentSchema = z.object({

    doctor_id: z.coerce
        .number({
            required_error:
                "الطبيب مطلوب"
        }),

    patient_name: z
        .string({
            required_error:
                "اسم المريض مطلوب"
        })
        .min(
            3,
            "اسم المريض قصير جدًا"
        )
        .max(
            50,
            "اسم المريض طويل جدًا"
        ),

    patient_phone: z
        .string({
            required_error:
                "رقم الهاتف مطلوب"
        })
        .min(
            6,
            "رقم الهاتف غير صالح"
        )
        .max(
            20,
            "رقم الهاتف غير صالح"
        ),

    patient_age: z.coerce
        .number({
            required_error:
                "العمر مطلوب"
        })
        .min(
            1,
            "العمر غير صالح"
        )
        .max(
            120,
            "العمر غير صالح"
        ),

    patient_gender: z.enum(
        [
            "male",
            "female"
        ],
        {
            errorMap: () => ({
                message:
                    "الجنس غير صالح"
            })
        }
    ),

    notes: z
        .string()
        .max(
            255,
            "الملاحظات طويلة جدًا"
        )
        .optional(),

    payment_receipt: z
        .string({
            required_error:
                "إيصال الدفع مطلوب"
        }),

    appointment_date: z
        .string({
            required_error:
                "تاريخ الموعد مطلوب"
        }),

    shift_type: z
        .string({
            required_error:
                "فترة الحجز مطلوبة"
        })

})



/* =========================
   Update Appointment Validation
========================= */


export const updateAppointmentSchema = z.object({

    patient_name: z
        .string()
        .min(
            3,
            "اسم المريض قصير جدًا"
        )
        .max(
            100,
            "اسم المريض طويل جدًا"
        )
        .optional(),

    patient_phone: z
        .string()
        .min(
            6,
            "رقم الهاتف غير صالح"
        )
        .max(
            20,
            "رقم الهاتف غير صالح"
        )
        .optional(),

    patient_age: z.coerce
        .number()
        .min(
            1,
            "العمر غير صالح"
        )
        .max(
            120,
            "العمر غير صالح"
        )
        .optional(),

    patient_gender: z
        .enum([
            "male",
            "female"
        ])
        .optional(),

    notes: z
        .string()
        .max(
            500,
            "الملاحظات طويلة جدًا"
        )
        .optional(),

    payment_receipt: z
        .string()
        .optional(),

    appointment_date: z
        .string()
        .optional(),

    shift_type: z
        .string()
        .optional()

})

    .refine(
        (data) =>
            Object.keys(data).length > 0,
        {
            message:
                "يجب إرسال حقل واحد على الأقل للتعديل"
        }
    );




/* =========================
   Change Appointment Status
========================= */

export const changeAppointmentsStatusSchema = z.object({

    status: z.enum(
        [
            "pending",
            "approved",
            "rejected",
            "cancelled",
        ],
        {
            errorMap: () => ({
                message:
                    "حالة الحجز غير صالحة"
            })
        }
    ),

    admin_notes: z
        .string()
        .max(
            100,
            "ملاحظات الإدارة طويلة جدًا"
        )
        .optional()

});
