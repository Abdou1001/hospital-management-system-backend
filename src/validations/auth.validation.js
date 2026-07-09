import {z} from "zod";

import {supabase} from "../config/supabase.js";

/* =========================
   Login Validation
========================= */

export const loginSchema = z.object({
    login: z
        .string({
            required_error: "رقم الهاتف أو البريد الإلكتروني مطلوب",
        })
        .trim()
        .min(1, "رقم الهاتف أو البريد الإلكتروني مطلوب"),

    password: z
        .string({
            required_error: "كلمة المرور مطلوبة",
        })
        .min(6, "كلمة المرور يجب أن تكون على الأقل 6 أحرف"),
});

/* =========================
   Register Validation
========================= */

export const registerSchema = z
    .object({
        full_name: z
            .string({
                required_error: "الاسم الكامل مطلوب",
            })
            .trim()
            .min(3, "الاسم الكامل قصير جدًا"),

        email: z
            .string()
            .trim()
            .email("البريد الإلكتروني غير صالح")
            .optional()
            .or(z.literal("")),

        password: z
            .string({
                required_error: "كلمة المرور مطلوبة",
            })
            .min(6, "كلمة المرور يجب أن تكون على الأقل 6 أحرف"),

        confirmPassword: z.string({
            required_error: "تأكيد كلمة المرور مطلوب",
        }),

        phone_number: z
            .string({
                required_error: "رقم الهاتف مطلوب",
            })
            .trim()
            .regex(/^7\d{8}$/, "رقم الهاتف اليمني غير صالح"),

        gender: z.enum(["male", "female"], {
            errorMap: () => ({
                message: "الجنس غير صالح",
            }),
        }),
    })

    // Password Confirm
    .refine((data) => data.password === data.confirmPassword, {
        path: ["confirmPassword"],
        message: "كلمتا المرور غير متطابقتين",
    })

    // Check Email & Phone Exists
    .superRefine(async (data, ctx) => {
        // Check phone
        const {data: phoneUser} = await supabase
            .from("user")
            .select("user_id")
            .eq("phone_number", data.phone_number)
            .single();

        if (phoneUser) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["phone_number"],
                message: "رقم الهاتف مستخدم بالفعل",
            });
        }

        // Check email only if entered
        if (data.email) {
            const {data: emailUser} = await supabase
                .from("user")
                .select("user_id")
                .eq("email", data.email)
                .single();

            if (emailUser) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["email"],
                    message: "البريد الإلكتروني مستخدم بالفعل",
                });
            }
        }
    });

/* =========================
   Verify Reset Code Validation
========================= */

export const verifyPasswordResetCodeSchema = z.object({
    phone_number: z
        .string({
            required_error: "رقم الهاتف مطلوب",
        })
        .trim()
        .regex(/^7\d{8}$/, "رقم الهاتف اليمني غير صالح"),

    resetCode: z
        .string({
            required_error: "الرجاء إدخال رمز التحقق",
        })
        .length(6, "يجب أن يتكون رمز التحقق من 6 أرقام"),
});


/* =========================
   Resend OTPS Validation
========================= */

export const resendOTPSchema = z.object({
    phone_number: z
        .string({
            required_error: "رقم الهاتف مطلوب",
        })
        .regex(/^7\d{8}$/, "رقم الهاتف اليمني غير صالح"),
});

/* =========================
   Change Phone Number Validation
========================= */

export const changePhoneNumberSchema = z.object({
    phone_number: z
        .string({
            required_error: "رقم الهاتف مطلوب",
        })
        .regex(/^7\d{8}$/, "رقم الهاتف اليمني غير صالح"),
});

/* =========================
   Verify Changed Phone Number Validation
========================= */

export const verifyChangePhoneNumberSchema = z.object({
    otp: z
        .string({
            required_error: "رمز التحقق مطلوب",
        })
        .length(6, "رمز التحقق يجب أن يتكون من 6 أرقام"),
});


/* =========================
   Forgot Password Validation
========================= */

export const forgotPasswordSchema = z.object({
    phone_number: z
        .string({
            required_error: "رقم الهاتف مطلوب",
        })
        .trim()
        .regex(/^7\d{8}$/, "رقم الهاتف اليمني غير صالح"),
});


/* =========================
   Verify Reset Code Validation
========================= */

export const verifyPhoneOTPSchema = z.object({
    otp: z
        .string({
            required_error: "الرجاء إدخال رمز التحقق",
        })
        .length(6, "يجب أن يتكون رمز التحقق من 6 أرقام"),

    phone_number: z
        .string({
            required_error: "رقم الهاتف مطلوب",
        })
        .trim()
        .regex(/^7\d{8}$/, "رقم الهاتف اليمني غير صالح"),
});

/* =========================
   Reset Password Validation
========================= */

export const resetPasswordSchema = z
    .object({
        phone_number: z
            .string({
                required_error: "رقم الهاتف مطلوب",
            })
            .trim()
            .regex(/^7\d{8}$/, "رقم الهاتف اليمني غير صالح"),

        newPassword: z
            .string({
                required_error: "كلمة المرور مطلوبة",
            })
            .min(6, "كلمة المرور يجب أن تكون على الأقل 6 أحرف"),

        confirmPassword: z.string({
            required_error: "تأكيد كلمة المرور مطلوب",
        }),
    })

    // Password Confirm
    .refine((data) => data.newPassword === data.confirmPassword, {
        path: ["confirmPassword"],
        message: "كلمتا المرور غير متطابقتين",
    });
