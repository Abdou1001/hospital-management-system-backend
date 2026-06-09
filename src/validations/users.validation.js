import { z } from "zod";

/* =========================
   Update My Profile
========================= */

export const updateMyProfileSchema = z.object({

    full_name: z
        .string()
        .min(
            3,
            "الاسم قصير جدًا"
        )
        .max(
            50,
            "الاسم طويل جدًا"
        )
        .optional(),

    age: z.coerce
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

    gender: z
        .enum([
            "male",
            "female"
        ])
        .optional(),

    phone_number: z
        .string()
        .min(
            6,
            "رقم الهاتف غير صالح"
        )
        .max(
            15,
            "رقم الهاتف غير صالح"
        )
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



/* =========================
   Update User
========================= */

export const updateUserSchema = updateMyProfileSchema;


/* =========================
   Change User Role
========================= */

export const changeUserRoleSchema = z.object({

    role: z.enum(
        [
            "admin",
            "reception",
            "user"
        ],
        {
            errorMap: () => ({
                message:
                    "الصلاحية غير صالحة"
            })
        }
    )

});



/* =========================
   Change Password
========================= */

export const changePasswordSchema = z.object({

    current_password: z
        .string({
            required_error:
                "كلمة المرور الحالية مطلوبة"
        }),

    new_password: z
        .string({
            required_error:
                "كلمة المرور الجديدة مطلوبة"
        })
        .min(
            6,
            "كلمة المرور قصيرة جدًا"
        ),

    confirm_password: z
        .string({
            required_error:
                "تأكيد كلمة المرور مطلوب"
        })

})

    .refine(
        (data) =>
            data.new_password ===
            data.confirm_password,
        {
            path: [
                "confirm_password"
            ],
            message:
                "تأكيد كلمة المرور غير متطابق"
        }
    )

    .refine(
        (data) =>
            data.current_password !==
            data.new_password,
        {
            path: [
                "new_password"
            ],
            message:
                "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية"
        }
    );