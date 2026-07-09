import {z} from "zod";
import {supabase} from "../config/supabase.js";

/* =========================
   insert Department Validation
========================= */

export const insertDepartmentSchema = z
    .object({
        depart_name: z
            .string({
                required_error: "اسم القسم مطلوب",
            })
            .min(2, "اسم القسم قصير جدًا")
            .max(20, "اسم القسم طويل جدًا"),
    })

    .superRefine(async (data, ctx) => {
        const {data: department} = await supabase
            .from("department")
            .select("depart_id")
            .eq("depart_name", data.depart_name)
            .single();

        if (department) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["depart_name"],
                message: "اسم القسم موجود بالفعل",
            });
        }
    });

/* =========================
   Update Department Validation
========================= */

export const updateDepartmentSchema = z
    .object({

        depart_name: z
            .string()
            .min(2, "اسم القسم قصير جدًا")
            .max(20, "اسم القسم طويل جدًا")
            .optional(),
    })
