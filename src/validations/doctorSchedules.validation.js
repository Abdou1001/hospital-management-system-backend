import {z} from "zod";

/* =========================
   Shared Schema
========================= */

const doctorScheduleSchema = z
    .object({
        doctor_id: z
            .number({
                required_error: "الطبيب مطلوب",
            })
            .int("معرف الطبيب غير صالح")
            .positive("معرف الطبيب غير صالح"),

        day_of_week: z.enum(
            [
                "الاحد",
                "الاثنين",
                "الثلاثاء",
                "الاربعاء",
                "الخميس",
                "الجمعة",
                "السبت",
            ],
            {
                error: () => ({
                    message: "اليوم المحدد غير صالح",
                }),
            },
        ),

        shift_type: z.enum(["صباحية", "مسائية"], {
            error: () => ({
                message: "نوع الدوام غير صالح",
            }),
        }),

        start_time: z
            .string("وقت بداية الدوام مطلوب")
            .regex(
                /^([01]?\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/,
                "صيغة وقت البداية غير صحيحة",
            ),

        end_time: z
            .string("وقت نهاية الدوام مطلوب")
            .regex(
                /^([01]?\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/,
                "صيغة وقت النهاية غير صحيحة",
            ),

        max_patients: z
            .number("الحد الأقصى للمرضى مطلوب")

            .int("يجب أن يكون عدداً صحيحاً")

            .min(1, "الحد الأدنى مريض واحد")

            .max(100, "الحد الأقصى غير منطقي"),

        status: z.enum(["active", "inactive"]),

        notes: z

            .string()

            .max(100, "الملاحظات طويلة جداً")

            .optional(),
    })

    .superRefine((data, ctx) => {
        // Start Time < End Time
        if (data.start_time >= data.end_time) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,

                path: ["end_time"],

                message: "وقت النهاية يجب أن يكون بعد وقت البداية",
            });
        }

        // Morning Shift
        if (data.shift_type === "morning") {
            if (data.start_time >= "12:00") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,

                    path: ["start_time"],

                    message: "الدوام الصباحي يجب أن يبدأ قبل الساعة 12:00",
                });
            }
        }

        // Evening Shift
        if (data.shift_type === "evening") {
            if (data.start_time < "12:00") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,

                    path: ["start_time"],

                    message: "الدوام المسائي يجب أن يبدأ بعد الساعة 12:00",
                });
            }
        }
    });

/* =========================
   Insert Doctor Schedule
========================= */

export const insertDoctorScheduleSchema = doctorScheduleSchema;

/* =========================
   Update Doctor Schedule
========================= */

export const updateDoctorScheduleSchema = doctorScheduleSchema;
