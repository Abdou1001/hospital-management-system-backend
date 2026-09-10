import {supabase} from "../config/supabase.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ============================================================
// Create notification in database
// ============================================================

export const createNotification = async ({
    userId = null,
    title,
    message,
    type,
    data = {},
}) => {
    const {data: notification, error} = await supabase
        .from("notifications")
        .insert({
            user_id: userId,
            title,
            message,
            type,
            data,
        })
        .select("*")
        .single();

    if (error) {
        throw new Error(`Failed to create notification: ${error.message}`);
    }

    return notification;
};

// ============================================================
// Get active devices for specific user
// ============================================================

const getUserDevices = async (userId) => {
    const {data: devices, error} = await supabase
        .from("user_devices")
        .select("device_id, user_id, expo_push_token, platform")
        .eq("user_id", userId)
        .eq("is_active", true);

    if (error) {
        throw new Error(
            `Failed to get user devices: ${error.message}`
        );
    }

    return devices || [];
};


// ============================================================
// Get all active devices
// ============================================================

const getAllActiveDevices = async () => {
    const {data: devices, error} = await supabase
        .from("user_devices")
        .select("device_id, user_id, expo_push_token, platform")
        .eq("is_active", true);

    if (error) {
        throw new Error(
            `Failed to get active devices: ${error.message}`
        );
    }

    return devices || [];
};

// ============================================================
// Send Push Notification
// ============================================================

export const sendPushNotification = async ({
    tokens,
    title,
    message,
    data = {},
}) => {
    if (!tokens?.length) {
        return [];
    }

    const results = [];

    // Expo يسمح بإرسال مجموعة من الرسائل في الطلب الواحد
    // نقسم الـ tokens إلى batches
    const BATCH_SIZE = 100;

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);

        const messages = batch.map((token) => ({
            to: token,
            title,
            body: message,
            data,
            sound: "default",
        }));

        const response = await fetch(EXPO_PUSH_URL, {
            method: "POST",

            headers: {
                Accept: "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },

            body: JSON.stringify(messages),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                `Expo Push Error: ${JSON.stringify(result)}`
            );
        }

        results.push(result);
    }

    return results;
};

// ============================================================
// Send notification to specific user
// ============================================================

export const sendNotificationToUser = async ({
    userId,
    title,
    message,
    type,
    data = {},
}) => {
    // --------------------------------------------------------
    // 1. Create notification in database
    // --------------------------------------------------------

    const notification = await createNotification({
        userId,
        title,
        message,
        type,
        data,
    });

    // --------------------------------------------------------
    // 2. Get user's active devices
    // --------------------------------------------------------

    const devices = await getUserDevices(userId);

    // --------------------------------------------------------
    // 3. Get Expo Push Tokens
    // --------------------------------------------------------

    const tokens = devices
        .map((device) => device.expo_push_token)
        .filter(Boolean);

    // --------------------------------------------------------
    // 4. Send Push Notification
    // --------------------------------------------------------

    let pushResult = null;

    if (tokens.length > 0) {
        pushResult = await sendPushNotification({
            tokens,
            title,
            message,
            data: {
                ...data,
                notification_id: notification.notification_id,
                type,
            },
        });
    }

    return {
        notification,
        devices_count: devices.length,
        push_result: pushResult,
    };
};

// ============================================================
// Send general notification to all active devices
// ============================================================

export const sendNotificationToAll = async ({
    title,
    message,
    type,
    data = {},
}) => {
    // --------------------------------------------------------
    // 1. Create general notification
    // --------------------------------------------------------

    const notification = await createNotification({
        userId: null,
        title,
        message,
        type,
        data,
    });

    // --------------------------------------------------------
    // 2. Get all active devices
    // --------------------------------------------------------

    const devices = await getAllActiveDevices();

    // --------------------------------------------------------
    // 3. Get Expo Push Tokens
    // --------------------------------------------------------

    const tokens = devices
        .map((device) => device.expo_push_token)
        .filter(Boolean);

    // --------------------------------------------------------
    // 4. Send Push
    // --------------------------------------------------------

    let pushResult = null;

    if (tokens.length > 0) {
        pushResult = await sendPushNotification({
            tokens,
            title,
            message,
            data: {
                ...data,
                notification_id: notification.notification_id,
                type,
            },
        });
    }

    return {
        notification,
        devices_count: devices.length,
        push_result: pushResult,
    };
};

// ============================================================
// Send discovery notification
// ============================================================

export const sendDiscoveryNotification = async () => {
    return sendNotificationToAll({
        title: "الأطباء متاحون الآن",
        message: "تصفح الأطباء واحجز موعدك بسهولة.",
        type: "discovery",
        data: {
            screen: "doctors",
        },
    });
};

// ============================================================
// Get active Reception devices
// ============================================================

const getReceptionDevices = async () => {
    // Get Reception users
    const {data: receptionUsers, error: usersError} =
        await supabase
            .from("user")
            .select("user_id")
            .eq("role", "reception");

    if (usersError) {
        throw new Error(
            `Failed to get reception users: ${usersError.message}`
        );
    }

    const userIds =
        receptionUsers?.map((user) => user.user_id) || [];

    if (userIds.length === 0) {
        return [];
    }

    // Get their active devices
    const {data: devices, error: devicesError} =
        await supabase
            .from("user_devices")
            .select(
                "device_id, user_id, expo_push_token, platform"
            )
            .in("user_id", userIds)
            .eq("is_active", true);

    if (devicesError) {
        throw new Error(
            `Failed to get reception devices: ${devicesError.message}`
        );
    }

    return devices || [];
};


// ============================================================
// Send pending appointments notification to Reception
// ============================================================

// ============================================================
// Send pending appointments notification to Reception
// ============================================================

export const sendPendingAppointmentsNotification = async ({
    count,
}) => {
    if (!count || count <= 0) {
        return {
            sent: false,
            devices_count: 0,
            pending_count: 0,
            reason: "NO_PENDING_APPOINTMENTS",
        };
    }

    const title = "حجوزات بانتظار التأكيد 🔔";

    const message =
        count === 1
            ? "يوجد حجز واحد بانتظار التأكيد، يرجى مراجعة الطلب."
            : `يوجد ${count} حجوزات بانتظار التأكيد، يرجى مراجعة الطلبات.`;

    // Get Reception users
    const {data: receptionUsers, error: usersError} =
        await supabase
            .from("user")
            .select("user_id")
            .eq("role", "reception");

    if (usersError) {
        throw new Error(
            `Failed to get reception users: ${usersError.message}`
        );
    }

    const users = receptionUsers || [];

    if (users.length === 0) {
        return {
            sent: false,
            devices_count: 0,
            pending_count: count,
            reason: "NO_RECEPTION_USERS",
        };
    }

    let totalDevices = 0;
    const pushResults = [];

    for (const user of users) {
        // Create personal notification
        const notification = await createNotification({
            userId: user.user_id,
            title,
            message,
            type: "appointment",
            data: {
                screen: "/appointments/pending",
                count,
            },
        });

        // Get user's active devices
        const devices = await getUserDevices(
            user.user_id
        );

        const tokens = devices
            .map((device) => device.expo_push_token)
            .filter(Boolean);

        totalDevices += devices.length;

        if (tokens.length === 0) {
            continue;
        }

        const pushResult = await sendPushNotification({
            tokens,
            title,
            message,
            data: {
                screen: "/appointments/pending",
                count,
                notification_id:
                    notification.notification_id,
                type: "appointment",
            },
        });

        pushResults.push({
            user_id: user.user_id,
            devices_count: devices.length,
            push_result: pushResult,
        });
    }

    return {
        sent: totalDevices > 0,
        devices_count: totalDevices,
        pending_count: count,
        push_result: pushResults,
    };
};