import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import {paginate, paginationResult} from "../utils/pagination.js";

// ============================================================
// Get all notifications
// @Route GET /api/notifications
// @Access Public
//
// المستخدم المسجل:
// - الإشعارات الخاصة به
// - الإشعارات العامة
//
// الزائر:
// - الإشعارات العامة فقط
// ============================================================
export const getNotifications = AsyncHandler(async (req, res, next) => {
    const {page, limit, from, to} = paginate(req);

    const userId = req.user?.user_id || null;
    const deviceId = req.headers["x-device-id"];

    if (!deviceId) {
        return next(new ApiError("Device ID مطلوب", 400));
    }

    // ------------------------------------------------------------
    // جلب الإشعارات
    // ------------------------------------------------------------

    let notificationsQuery = supabase
        .from("notifications")
        .select("*", {count: "exact"})
        .is("user_id", null)
        .order("created_at", {ascending: false})
        .range(from, to);

    // إذا كان المستخدم مسجلًا
    // نضيف إشعاراته الشخصية
    if (userId) {
        notificationsQuery = supabase
            .from("notifications")
            .select("*", {count: "exact"})
            .or(`user_id.eq.${userId},user_id.is.null`)
            .order("created_at", {ascending: false})
            .range(from, to);
    }

    const {
        data: notifications,
        error: notificationsError,
        count,
    } = await notificationsQuery;

    if (notificationsError) {
        return next(new ApiError("حدث خطأ أثناء جلب الإشعارات", 500));
    }

    // ------------------------------------------------------------
    // جلب الإشعارات التي قرأها الجهاز
    // ------------------------------------------------------------

    const notificationIds =
        notifications?.map((notification) => notification.notification_id) ||
        [];

    let reads = [];

    if (notificationIds.length > 0) {
        const {data, error: readsError} = await supabase
            .from("notification_reads")
            .select("notification_id, read_at, is_deleted")
            .eq("device_id", deviceId)
            .in("notification_id", notificationIds);

        if (readsError) {
            return next(
                new ApiError("حدث خطأ أثناء جلب حالة قراءة الإشعارات", 500),
            );
        }

        reads = data || [];
    }

    // ------------------------------------------------------------
    // تجهيز حالة كل إشعار
    // ------------------------------------------------------------

    const readMap = new Map(reads.map((read) => [read.notification_id, read]));

    const results =
        notifications
            ?.map((notification) => {
                const read = readMap.get(notification.notification_id);

                return {
                    ...notification,
                    is_read: !!read,
                    read_at: read?.read_at || null,
                };
            })
            .filter((notification) => {
                const read = readMap.get(notification.notification_id);

                return !read?.is_deleted;
            }) || [];

    // ------------------------------------------------------------
    // unread count
    // ------------------------------------------------------------

    // في هذه المرحلة نحسب غير المقروء من النتائج الحالية.
    // لاحقًا يمكن تحسينها إلى RPC إذا احتجنا العدد الكامل
    // عبر جميع الصفحات.
    const unreadCount = results.filter(
        (notification) => !notification.is_read,
    ).length;

    // ------------------------------------------------------------
    // Pagination
    // ------------------------------------------------------------

    const pagination = paginationResult(page, limit, count);

    // ------------------------------------------------------------
    // Response
    // ------------------------------------------------------------

    res.status(200).json({
        status: "success",
        message: "تم جلب الإشعارات بنجاح",
        pagination,
        unread_count: unreadCount,
        results,
    });
});

// ============================================================
// Get one notification
// @Route GET /api/notifications/:id
// @Access Public
// ============================================================
export const getOneNotification = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const userId = req.user?.user_id || null;
    const deviceId = req.headers["x-device-id"];

    if (!deviceId) {
        return next(new ApiError("Device ID مطلوب", 400));
    }

    // --------------------------------------------------------
    // جلب الإشعار
    // --------------------------------------------------------

    let query = supabase
        .from("notifications")
        .select("*")
        .eq("notification_id", id)
        .is("user_id", null);

    // المستخدم المسجل يستطيع رؤية:
    // العام + الخاص به
    if (userId) {
        query = supabase
            .from("notifications")
            .select("*")
            .eq("notification_id", id)
            .or(`user_id.eq.${userId},user_id.is.null`);
    }

    const {data: notification, error} = await query.maybeSingle();

    if (error || !notification) {
        return next(new ApiError("الإشعار غير موجود", 404));
    }

    // --------------------------------------------------------
    // حالة القراءة
    // --------------------------------------------------------

    const {data: read, error: readError} = await supabase
        .from("notification_reads")
        .select("read_at, is_deleted")
        .eq("notification_id", id)
        .eq("device_id", deviceId)
        .maybeSingle();

    if (readError) {
        return next(new ApiError("حدث خطأ أثناء جلب حالة الإشعار", 500));
    }

    if (read?.is_deleted) {
        return next(new ApiError("الإشعار غير موجود", 404));
    }

    res.status(200).json({
        status: "success",
        message: "تم جلب الإشعار بنجاح",
        results: {
            ...notification,
            is_read: !!read,
            read_at: read?.read_at || null,
        },
    });
});

// ============================================================
// Mark notification as read
// @Route PATCH /api/notifications/:id/read
// @Access Public
// ============================================================
export const markNotificationAsRead = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const userId = req.user?.user_id || null;
    const deviceId = req.headers["x-device-id"];

    if (!deviceId) {
        return next(new ApiError("Device ID مطلوب", 400));
    }

    // --------------------------------------------------------
    // التأكد أن الإشعار موجود ومسموح للجهاز رؤيته
    // --------------------------------------------------------

    let query = supabase
        .from("notifications")
        .select("notification_id")
        .eq("notification_id", id)
        .is("user_id", null);

    if (userId) {
        query = supabase
            .from("notifications")
            .select("notification_id")
            .eq("notification_id", id)
            .or(`user_id.eq.${userId},user_id.is.null`);
    }

    const {data: notification, error: notificationError} =
        await query.maybeSingle();

    if (notificationError || !notification) {
        return next(new ApiError("الإشعار غير موجود", 404));
    }

    // --------------------------------------------------------
    // تسجيل القراءة
    // --------------------------------------------------------

    const {data: read, error} = await supabase
        .from("notification_reads")
        .upsert(
            {
                notification_id: Number(id),
                device_id: Number(deviceId),
                read_at: new Date().toISOString(),
                is_deleted: false,
            },
            {
                onConflict: "notification_id,device_id",
            },
        )
        .select("*")
        .single();

    if (error) {
        return next(new ApiError("حدث خطأ أثناء تحديد الإشعار كمقروء", 500));
    }

    res.status(200).json({
        status: "success",
        message: "تم تحديد الإشعار كمقروء",
        results: read,
    });
});

// ============================================================
// Mark all notifications as read
// @Route PATCH /api/notifications/read-all
// @Access Public
// ============================================================
export const markAllNotificationsAsRead = AsyncHandler(
    async (req, res, next) => {
        const userId = req.user?.user_id || null;
        const deviceId = req.headers["x-device-id"];

        if (!deviceId) {
            return next(new ApiError("Device ID مطلوب", 400));
        }

        // --------------------------------------------------------
        // جلب الإشعارات المتاحة للجهاز
        // --------------------------------------------------------

        let query = supabase
            .from("notifications")
            .select("notification_id")
            .is("user_id", null);

        if (userId) {
            query = supabase
                .from("notifications")
                .select("notification_id")
                .or(`user_id.eq.${userId},user_id.is.null`);
        }

        const {data: notifications, error} = await query;

        if (error) {
            return next(new ApiError("حدث خطأ أثناء جلب الإشعارات", 500));
        }

        if (!notifications?.length) {
            return res.status(200).json({
                status: "success",
                message: "لا توجد إشعارات لتحديدها كمقروءة",
            });
        }

        // --------------------------------------------------------
        // إنشاء سجلات القراءة
        // --------------------------------------------------------

        const reads = notifications.map((notification) => ({
            notification_id: notification.notification_id,
            device_id: Number(deviceId),
            read_at: new Date().toISOString(),
            is_deleted: false,
        }));

        const {error: readsError} = await supabase
            .from("notification_reads")
            .upsert(reads, {
                onConflict: "notification_id,device_id",
            });

        if (readsError) {
            return next(
                new ApiError("حدث خطأ أثناء تحديد جميع الإشعارات كمقروءة", 500),
            );
        }

        res.status(200).json({
            status: "success",
            message: "تم تحديد جميع الإشعارات كمقروءة",
        });
    },
);

// ============================================================
// Delete one notification
// @Route DELETE /api/notifications/:id
// @Access Public
//
// لا نحذف notification نفسها.
// فقط نخفيها لهذا الجهاز.
// ============================================================
export const deleteNotification = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const userId = req.user?.user_id || null;
    const deviceId = req.headers["x-device-id"];

    if (!deviceId) {
        return next(new ApiError("Device ID مطلوب", 400));
    }

    // التأكد أن الإشعار موجود
    let query = supabase
        .from("notifications")
        .select("notification_id")
        .eq("notification_id", id)
        .is("user_id", null);

    if (userId) {
        query = supabase
            .from("notifications")
            .select("notification_id")
            .eq("notification_id", id)
            .or(`user_id.eq.${userId},user_id.is.null`);
    }

    const {data: notification, error: notificationError} =
        await query.maybeSingle();

    if (notificationError || !notification) {
        return next(new ApiError("الإشعار غير موجود", 404));
    }

    // --------------------------------------------------------
    // نخفي الإشعار لهذا الجهاز فقط
    // --------------------------------------------------------

    const {data: deletedNotification, error} = await supabase
        .from("notification_reads")
        .upsert(
            {
                notification_id: Number(id),
                device_id: Number(deviceId),
                is_deleted: true,
            },
            {
                onConflict: "notification_id,device_id",
            },
        )
        .select("*")
        .single();

    if (error) {
        return next(new ApiError("حدث خطأ أثناء حذف الإشعار", 500));
    }

    res.status(200).json({
        status: "success",
        message: "تم حذف الإشعار بنجاح",
        results: deletedNotification,
    });
});

// ============================================================
// Delete all notifications
// @Route DELETE /api/notifications
// @Access Public
// ============================================================
export const deleteAllNotifications = AsyncHandler(async (req, res, next) => {
    const userId = req.user?.user_id || null;
    const deviceId = req.headers["x-device-id"];

    if (!deviceId) {
        return next(new ApiError("Device ID مطلوب", 400));
    }

    // --------------------------------------------------------
    // جلب كل الإشعارات المتاحة
    // --------------------------------------------------------

    let query = supabase
        .from("notifications")
        .select("notification_id")
        .is("user_id", null);

    if (userId) {
        query = supabase
            .from("notifications")
            .select("notification_id")
            .or(`user_id.eq.${userId},user_id.is.null`);
    }

    const {data: notifications, error} = await query;

    if (error) {
        return next(new ApiError("حدث خطأ أثناء جلب الإشعارات", 500));
    }

    if (!notifications?.length) {
        return res.status(200).json({
            status: "success",
            message: "لا توجد إشعارات لحذفها",
        });
    }

    // --------------------------------------------------------
    // إخفاء جميع الإشعارات لهذا الجهاز
    // --------------------------------------------------------

    const deletedNotifications = notifications.map((notification) => ({
        notification_id: notification.notification_id,
        device_id: Number(deviceId),
        is_deleted: true,
    }));

    const {error: deleteError} = await supabase
        .from("notification_reads")
        .upsert(deletedNotifications, {
            onConflict: "notification_id,device_id",
        });

    if (deleteError) {
        return next(new ApiError("حدث خطأ أثناء حذف جميع الإشعارات", 500));
    }

    res.status(200).json({
        status: "success",
        message: "تم حذف جميع الإشعارات بنجاح",
    });
});
