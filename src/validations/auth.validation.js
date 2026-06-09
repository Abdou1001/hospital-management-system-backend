import { z } from "zod";

import { supabase }
    from "../config/supabase.js";

/* =========================
   Login Validation
========================= */

export const loginSchema = z.object({
    email: z
        .string({
            required_error:
                "البريد الإلكتروني مطلوب",
        })
        .email(
            "البريد الإلكتروني غير صالح"
        ),

    password: z
        .string({
            required_error:
                "كلمة المرور مطلوبة",
        })
        .min(
            6,
            "كلمة المرور يجب أن تكون على الأقل 6 أحرف"
        ),

});

/* =========================
   Register Validation
========================= */

export const registerSchema = z.object({

    full_name: z
        .string({
            required_error:
                "الاسم الكامل مطلوب",
        })
        .min(
            3,
            "الاسم الكامل قصير جدًا"
        ),

    email: z
        .string({
            required_error:
                "البريد الإلكتروني مطلوب",
        })
        .email(
            "البريد الإلكتروني غير صالح"
        ),

    password: z
        .string({
            required_error:
                "كلمة المرور مطلوبة",
        })
        .min(
            6,
            "كلمة المرور يجب أن تكون على الأقل 6 أحرف"
        ),

    confirmPassword:
        z.string({
            required_error:
                "تأكيد كلمة المرور مطلوب",
        }),

    phone_number: z
        .string()
        .min(
            9,
            "رقم الهاتف غير صالح"
        )
        .optional(),

    gender: z.enum(
        [
            "male",
            "female"
        ],
        {
            errorMap: () => ({
                message:
                    "الصلاحية غير صالح",
            })
        }
    )

})

    /* Password Confirm */
    .refine(
        (data) =>
            data.password ===
            data.confirmPassword,
        {
            path: ["confirmPassword"],
            message: "كلمتا المرور غير متطابقتين",
        }
    )

    /* Check Email Exist */
    .superRefine(
        async (data, ctx) => {

            const { data: user, error, } = await supabase
                .from("users")
                .select("email")
                .eq(
                    "email",
                    data.email
                )
                .single();

            if (user) {

                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["email"],
                    message: "البريد الإلكتروني مستخدم بالفعل",
                });

            }

        }
    );


/* =========================
   Forgot Password Validation
========================= */

export const forgotPasswordSchema = z.object({

    email: z
        .string({
            required_error:
                "البريد الإلكتروني مطلوب",
        })

        .email(
            "البريد الإلكتروني غير صالح"
        ),

});


/* =========================
   Verify Reset Code Validation
========================= */

export const verifyPasswordResetCodeSchema = z.object({

    resetCode: z
        .string({
            required_error:
                "الرجاء إدخال رمز التحقق",
        })

        .length(
            6,
            "يجب أن يتكون رمز التحقق من 6 أرقام"
        ),

});


/* =========================
   Reset Password Validation
========================= */

export const resetPasswordSchema = z.object({

    newPassword: z
        .string({
            required_error: "كلمة المرور مطلوبة",
        })
        .min(
            6,
            "كلمة المرور يجب أن تكون على الأقل 6 أحرف"
        ),

    confirmPassword: z
        .string({
            required_error: " تأكيد كلمة المرور مطلوبة",
        })

})

    /* Password Confirm */
    .refine(
        (data) =>
            data.newPassword === data.confirmPassword,

        {
            path: "confirmPassword",
            message: "كلمتا المرور غير متطابقتين"
        }
    );