import cron from "node-cron";
import {supabase} from "../config/supabase.js";
import {sendPendingAppointmentsNotification} from "../services/notification.service.js";

export const startAppointmentNotificationJobs = () => {
    cron.schedule(
        "0 */2 * * *",
        async () => {
            console.log(
                `[Appointment Notification] Checking at ${new Date().toISOString()}`,
            );

            try {
                // تاريخ اليوم
                const now = new Date();

                const today = new Date(
                    Date.UTC(
                        now.getUTCFullYear(),
                        now.getUTCMonth(),
                        now.getUTCDate(),
                    ),
                );

                // غداً
                const tomorrow = new Date(today);
                tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

                const todayDate = today.toISOString().split("T")[0];
                const tomorrowDate = tomorrow.toISOString().split("T")[0];

                // جلب عدد الحجوزات المعلقة
                const {count, error} = await supabase
                    .from("appointment")
                    .select("appointment_id", {
                        count: "exact",
                        head: true,
                    })
                    .eq("status", "pending")
                    .gte("appointment_date", todayDate)
                    .lte("appointment_date", tomorrowDate);

                if (error) {
                    throw new Error(
                        `Failed to count pending appointments: ${error.message}`,
                    );
                }

                const pendingCount = count || 0;

                console.log(
                    `[Appointment Notification] Pending appointments: ${pendingCount}`,
                );

                // لا توجد حجوزات معلقة
                if (pendingCount === 0) {
                    console.log(
                        "[Appointment Notification] No pending appointments. Skipping.",
                    );

                    return;
                }

                // إرسال الإشعار للاستقبال
                const result = await sendPendingAppointmentsNotification({
                    count: pendingCount,
                });

                console.log(
                    `[Appointment Notification] Sent to ${result.devices_count} devices`,
                );

                console.log(
                    "[Appointment Notification] Expo result:",
                    JSON.stringify(result.push_result, null, 2),
                );
            } catch (error) {
                console.error(
                    "[Appointment Notification] Failed:",
                    error.message,
                );
            }
        },
        {
            timezone: "Asia/Aden",
        },
    );

    console.log("Appointment notification jobs started - Every 2 hours");
};
