import {z} from "zod";

/* =========================
   Shared Fields
========================= */

const adFields = {
    start_date: z.string({
        required_error: "تاريخ بداية الإعلان مطلوب",
    }),

    end_date: z.string({
        required_error: "تاريخ انتهاء الإعلان مطلوب",
    }),
};

const validateDates = (data) =>
    !data.start_date ||
    !data.end_date ||
    new Date(data.end_date) > new Date(data.start_date);

/* =========================
   Insert Ad Validation
========================= */

export const insertAdSchema = z.object(adFields).refine(validateDates, {
    path: ["end_date"],
    message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية",
});

/* =========================
   Update Ad Validation
========================= */

export const updateAdSchema = z
    .object({
        start_date: adFields.start_date.optional(),

        end_date: adFields.end_date.optional(),

        status: z.enum(["active", "inactive"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "يجب إرسال حقل واحد على الأقل للتعديل",
    })
    .refine(validateDates, {
        path: ["end_date"],
        message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية",
    });
