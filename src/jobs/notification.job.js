import cron from "node-cron";
import {supabase} from "../config/supabase.js";
import {sendNotificationToAll} from "../services/notification.service.js";

const discoveryMessages = [
    {
        title: "تبحث عن طبيب مناسب؟ 👨‍⚕️",
        message:
            "لا تحتار في البحث، تصفح أطباءنا وتعرف على تخصصاتهم وخدماتهم من التطبيق.",
    },
    {
        title: "متى كانت آخر زيارة لك للطبيب؟ 🩺",
        message:
            "إذا كنت تؤجل موعدك، تصفح الأطباء المتاحين واحجز موعدك بسهولة من التطبيق.",
    },
    {
        title: "هل تبحث عن تخصص معين؟ 🔎",
        message:
            "اكتشف التخصصات والأطباء المتاحين واختر الطبيب الذي يناسب احتياجك.",
    },
    {
        title: "لا تجعل البحث عن الطبيب صعبًا عليك",
        message:
            "من التطبيق يمكنك تصفح الأطباء ومعرفة تخصصاتهم قبل اختيار موعدك.",
    },
    {
        title: "قد يكون طبيبك المناسب أقرب مما تتوقع 👨‍⚕️",
        message:
            "تصفح قائمة الأطباء واكتشف التخصصات والخدمات المتاحة في المستشفى.",
    },
    {
        title: "هل تعرف أطباء المستشفى؟",
        message:
            "ادخل التطبيق واستكشف أطباءنا وتعرف على تخصصاتهم قبل حجز موعدك.",
    },
    {
        title: "لديك استفسار صحي؟ 🩺",
        message:
            "ابدأ بالخطوة الأولى، تعرف على التخصص المناسب ثم اكتشف الأطباء المتاحين.",
    },
    {
        title: "اكتشف الأطباء المتاحين اليوم 🔔",
        message:
            "قد تجد الطبيب الذي تبحث عنه، تصفح الأطباء والتخصصات من التطبيق.",
    },
    {
        title: "حجز موعدك يبدأ من هنا 📅",
        message:
            "تصفح الأطباء، اختر التخصص المناسب، ثم احجز موعدك بسهولة من التطبيق.",
    },
    {
        title: "لا تؤجل موعدك أكثر",
        message:
            "إذا كنت بحاجة إلى مراجعة طبيب، يمكنك اكتشاف الأطباء وحجز موعدك من التطبيق.",
    },
];

const getRandomMessage = () => {
    return discoveryMessages[
        Math.floor(Math.random() * discoveryMessages.length)
    ];
};

export const startNotificationJobs = () => {
    // يعمل كل يوم الساعة 11:00 صباحًا بتوقيت عدن
    cron.schedule(
        "0 11 * * *",
        async () => {
            console.log(
                `[Notification Job] Checking at ${new Date().toISOString()}`,
            );

            try {
                // آخر إشعار Discovery عام
                const {data: lastNotification, error} = await supabase
                    .from("notifications")
                    .select("notification_id, created_at")
                    .is("user_id", null)
                    .eq("type", "discovery")
                    .order("created_at", {ascending: false})
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    throw new Error(
                        `Failed to check last notification: ${error.message}`,
                    );
                }

                // منع إرسال Discovery إذا لم تمر 3 أيام
                if (lastNotification) {
                    const lastSentAt = new Date(
                        lastNotification.created_at,
                    ).getTime();

                    const now = Date.now();

                    const threeDays = 3 * 24 * 60 * 60 * 1000;

                    if (now - lastSentAt < threeDays) {
                        console.log(
                            "[Notification Job] 3 days have not passed yet. Skipping.",
                        );
                        return;
                    }
                }

                // اختيار رسالة عشوائية
                const notification = getRandomMessage();

                console.log(
                    `[Notification Job] Sending: ${notification.title}`,
                );

                const result = await sendNotificationToAll({
                    title: notification.title,
                    message: notification.message,
                    type: "discovery",
                    data: {
                        screen: "/doctors",
                    },
                });

                console.log(
                    `[Notification Job] Sent to ${result.devices_count} devices`,
                );

                console.log(
                    "[Notification Job] Expo result:",
                    JSON.stringify(result.push_result, null, 2),
                );
            } catch (error) {
                console.error("[Notification Job] Failed:", error.message);
            }
        },
        {
            timezone: "Asia/Aden",
        },
    );

    console.log("Notification jobs started - Every 3 days at 11:00 AM");
};
