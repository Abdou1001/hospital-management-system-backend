import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";

// @Desc Register user device
// @Route POST : /api/devices
// @Access Public
export const registerDevice = AsyncHandler(async (req, res, next) => {
    // User ID إذا كان المستخدم مسجل
    // وإذا كان زائر سيكون null
    const userId = req.user?.user_id || null;

    const {expo_push_token, platform} = req.body;

    // Validate
    if (!expo_push_token) {
        return next(new ApiError("Expo Push Token مطلوب", 400));
    }

    // Check if device already exists
    const {data: existingDevice, error: findError} = await supabase
        .from("user_devices")
        .select("*")
        .eq("expo_push_token", expo_push_token)
        .maybeSingle();

    if (findError) {
        return next(new ApiError("حدث خطأ أثناء التحقق من الجهاز", 500));
    }

    // Update existing device
    if (existingDevice) {
        const {data: device, error} = await supabase
            .from("user_devices")
            .update({
                user_id: userId,
                platform,
                is_active: true,
                updated_at: new Date().toISOString(),
            })
            .eq("device_id", existingDevice.device_id)
            .select("*")
            .single();

        if (error) {
            return next(new ApiError("حدث خطأ أثناء تحديث بيانات الجهاز", 500));
        }

        return res.status(200).json({
            status: "success",
            message: "تم تحديث الجهاز بنجاح",
            results: device,
        });
    }

    // Insert new device
    const {data: device, error} = await supabase
        .from("user_devices")
        .insert({
            user_id: userId,
            expo_push_token,
            platform,
            is_active: true,
        })
        .select("*")
        .single();

    if (error) {
        return next(new ApiError("حدث خطأ أثناء تسجيل الجهاز", 500));
    }

    res.status(201).json({
        status: "success",
        message: "تم تسجيل الجهاز بنجاح",
        results: device,
    });
});

// @Desc Remove user device
// @Route DELETE : /api/devices
// @Access Public
export const removeDevice = AsyncHandler(async (req, res, next) => {
    const userId = req.user?.user_id || null;

    const {expo_push_token} = req.body;

    // Validate
    if (!expo_push_token) {
        return next(new ApiError("Expo Push Token مطلوب", 400));
    }

    // Delete device
    let query = supabase
        .from("user_devices")
        .delete()
        .eq("expo_push_token", expo_push_token);

    // If user is logged in, make sure
    // he can only delete his own device
    if (userId) {
        query = query.eq("user_id", userId);
    } else {
        // Visitor
        query = query.is("user_id", null);
    }

    const {data: device, error} = await query.select("*").maybeSingle();

    if (error) {
        return next(new ApiError("حدث خطأ أثناء حذف الجهاز", 500));
    }

    if (!device) {
        return next(new ApiError("الجهاز غير موجود", 404));
    }

    res.status(200).json({
        status: "success",
        message: "تم حذف الجهاز بنجاح",
        results: device,
    });
});
