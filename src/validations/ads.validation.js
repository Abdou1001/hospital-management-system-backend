import { z } from "zod";

/* =========================
   Insert Ad Validation
========================= */

export const insertAdSchema = z.object({

    title: z
        .string({
            required_error:
                "عنوان الإعلان مطلوب",
        })
        .min(
            3,
            "عنوان الإعلان قصير جدًا"
        )
        .max(
            50,
            "عنوان الإعلان طويل جدًا"
        ),

    description: z
        .string({
            required_error:
                "وصف الإعلان مطلوب",
        })
        .min(
            5,
            "وصف الإعلان قصير جدًا"
        )
        .max(
            500,
            "وصف الإعلان طويل جدًا"
        ),

    path_image: z
        .string({
            required_error:
                "صورة الإعلان مطلوبة",
        }),

    start_date: z
        .string({
            required_error:
                "تاريخ بداية الإعلان مطلوب",
        }),

    end_date: z
        .string({
            required_error:
                "تاريخ انتهاء الإعلان مطلوب",
        }),

})
    .refine(
        (data) =>
            new Date(data.end_date) >
            new Date(data.start_date),

        {
            path: [
                "end_date"
            ],
            message:
                "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية",
        }
    );




/* =========================
   Update Ad Validation
========================= */

export const updateAdSchema = z.object({

    title: z
        .string()
        .min(
            3,
            "عنوان الإعلان قصير جدًا"
        )
        .max(
            50,
            "عنوان الإعلان طويل جدًا"
        )
        .optional(),

    description: z
        .string()
        .min(
            5,
            "وصف الإعلان قصير جدًا"
        )
        .max(
            500,
            "وصف الإعلان طويل جدًا"
        )
        .optional(),

    path_image: z
        .string()
        .optional(),

    start_date: z
        .string()
        .optional(),

    end_date: z
        .string()
        .optional(),

    status: z
        .enum([
            "active",
            "inactive"
        ])
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