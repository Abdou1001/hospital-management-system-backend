import { z } from "zod";


/* =========================
   Assign Doctor To DepartmentSchema Validation
========================= */
export const assignDoctorToDepartmentSchema = z.object({

    doctor_id: z.coerce

        .number({
            required_error:
                "الدكتور مطلوب"
        })

        .positive(
            "معرف الدكتور غير صالح"
        ),

    depart_id: z.coerce

        .number({
            required_error:
                "القسم مطلوب"
        })

        .positive(
            "معرف القسم غير صالح"
        )

});