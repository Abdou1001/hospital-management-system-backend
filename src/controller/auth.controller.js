// Database Connection
import {supabase} from "../config/supabase.js";

import AsyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
// encription tools
import bcrypt from "bcrypt";
import crypto from "crypto";
// send email to rest password
import {sendEmail} from "../utils/sendEmail.js";
import {resetPasswordTemplate} from "../utils/emailTemplate.js";
import {normalizeYemenPhone} from "../utils/phone.js";
import {generateOTPData, hashOTP} from "../utils/otp.js";
import {sendOTP} from "../services/whatsapp.service.js";
import { deleteCache } from "../services/cache.service.js";
import { CACHE_KEYS } from "../config/cache.js";

// @Desc Makes Toke for login yours
// @Param Takes user_هd and role to make token
const createToken = (payload) =>
    jwt.sign(payload, process.env.SECRET_KEY_JWT, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });

// @Desc Makes cookie to put toke on it for premissions
//      (this function is using createToken() to generate token)
// @Param Takes user to create token statusCode to put if success res to send response
export const createSendToken = (user, statusCode, res) => {
    // Generate token
    const token = createToken({
        user_id: user.user_id,
        role: user.role,
    });

    // delete password for enhance secure
    delete user.password;

    // Make cookie
    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // send response
    res.status(statusCode).json({
        status: "success",
        message: "تم تسجيل الدخول بنجاح",
        user,
    });
};

// ===== auth opertions ====

// @Desc Login Controller, Check if phone or email exist in db then Check Password
// @Route POST : api/auth/login
// @Access Public
export const login = AsyncHandler(async (req, res, next) => {
    const {login, password} = req.body;

    let query = supabase.from("user").select("*");

    // Login by email or phone
    if (login.includes("@")) {
        query = query.eq("email", login.trim().toLowerCase());
    } else {
        query = query.eq("phone_number", normalizeYemenPhone(login));
    }

    const {data: user, error} = await query.single();

    if (
        error ||
        !user ||
        !(await bcrypt.compare(password, user?.password || ""))
    )
        return next(
            new ApiError(
                "رقم الهاتف أو البريد الإلكتروني أو كلمة المرور غير صحيحة",
                401,
            ),
        );

    // Check phone verified
    if (!user.phone_verified)
        return next(
            new ApiError(
                "الحساب غير مفعل. يرجى إكمال تفعيل رقم الهاتف، أو إعادة التسجيل لإرسال رمز تحقق جديد.",
                401,
            ),
        );

    // Check account status
    if (user.is_Active == "inactive")
        return next(
            new ApiError(
                "الحساب موقف من الإدارة، يرجى التواصل مع الإدارة",
                401,
            ),
        );

    // Generate token and put it in cookies
    createSendToken(user, 200, res);
});

// @Desc Register New User
// @Route POST : api/auth/register
// @Access Public
export const register = AsyncHandler(async (req, res, next) => {
    // Destructuring
    const {
        full_name,
        email,
        password,
        date_of_birth,
        gender,
        phone_number,
    } = req.body;

    // Normalize phone number
    const phone = normalizeYemenPhone(phone_number);

    // Check phone
    const {data: existingUser} = await supabase
        .from("user")
        .select("*")
        .eq("phone_number", phone)
        .maybeSingle();

    if (existingUser) {
        // Account already verified
        if (existingUser.phone_verified) {
            return next(
                new ApiError(
                    "رقم الهاتف مسجل بالفعل، يمكنك تسجيل الدخول",
                    409,
                ),
            );
        }

        // Generate OTP
        const {otp, hashedOTP, expires} = generateOTPData();

        // Update OTP
        const {error: updateError} = await supabase
            .from("user")
            .update({
                phone_otp: hashedOTP,
                phone_otp_expires: expires,
            })
            .eq("user_id", existingUser.user_id);

        if (updateError) {
            return next(
                new ApiError("حدث خطأ أثناء إنشاء رمز التحقق", 500),
            );
        }

        // Send WhatsApp OTP
        await sendOTP(phone, otp);

        console.log(otp);

        return res.status(200).json({
            status: "success",
            message:
                "الحساب غير مفعل، تم إرسال رمز تحقق جديد إلى رقم هاتفك",
        });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP
    const {otp, hashedOTP, expires} = generateOTPData();

    // Create user
    const {data: user, error} = await supabase
        .from("user")
        .insert([
            {
                full_name,
                email: email || null,
                password: hashedPassword,

                date_of_birth,
                gender,

                phone_number: phone,
                phone_verified: false,
                phone_otp: hashedOTP,
                phone_otp_expires: expires,

                role: "user",
                is_active: "active",
                created_at: new Date(),
            },
        ])
        .select("*")
        .single();

    // Handle DB error
    if (error) {
        console.error(error);

        return next(
            new ApiError(
                "حدث خطأ أثناء إنشاء الحساب، حاول مرة أخرى",
                400,
            ),
        );
    }

    // Send WhatsApp OTP
    await sendOTP(phone, otp);

    console.log(otp);

    res.status(201).json({
        status: "success",
        message:
            "تم إنشاء الحساب بنجاح، تم إرسال رمز التحقق إلى رقم الواتساب الخاص بك",
    });
});

// @Desc Verify Phone OTP
// @Route POST : /api/auth/verify-phone
// @Access Public
export const verifyPhoneOTP = AsyncHandler(async (req, res, next) => {
    const {phone_number, otp} = req.body;

    // Normalize phone
    const phone = normalizeYemenPhone(phone_number);

    // Hash OTP
    const hashedOTP = hashOTP(otp);

    // Get user
    const {data: user, error} = await supabase
        .from("user")
        .select("*")
        .eq("phone_number", phone)
        .single();

    if (!user || error) return next(new ApiError("الحساب غير موجود", 404));

    // Already verified
    if (user.phone_verified)
        return next(
            new ApiError("تم تفعيل الحساب مسبقًا، يمكنك تسجيل الدخول", 400),
        );

    // Check OTP
    if (user.phone_otp !== hashedOTP)
        return next(new ApiError("رمز التحقق غير صحيح، حاول مرة اخرى", 400));

    // Check Expiration
    const expiresAt = Date.parse(user.phone_otp_expires);

    console.log("Expires:", new Date(expiresAt).toISOString());
    console.log("Now:", new Date().toISOString());

    if (Date.now() > user.phone_otp_expires)
        return next(new ApiError("انتهت صلاحية رمز التحقق", 400));

    // Verify account
    const {data: verifiedUser, error: updateError} = await supabase
        .from("user")
        .update({
            phone_verified: true,
            phone_otp: null,
            phone_otp_expires: null,
        })
        .eq("user_id", user.user_id)
        .select("*")
        .single();

    if (!verifiedUser || updateError)
        return next(new ApiError("حدث خطأ أثناء تفعيل الحساب", 500));

    await deleteCache(CACHE_KEYS.DASHBOARD);

    // Login مباشرة
    createSendToken(verifiedUser, 200, res);
});

// @Desc Resend Phone Verification OTP
// @Route POST : /api/auth/resend-otp
// @Access Public
export const resendOTP = AsyncHandler(async (req, res, next) => {
    const {phone_number} = req.body;

    // Normalize phone
    const phone = normalizeYemenPhone(phone_number);

    // Check user
    const {data: user, error} = await supabase
        .from("user")
        .select("*")
        .eq("phone_number", phone)
        .single();

    if (!user || error) return next(new ApiError("الحساب غير موجود", 404));

    // Already verified
    if (user.phone_verified)
        return next(
            new ApiError("تم تفعيل الحساب مسبقًا، يمكنك تسجيل الدخول", 400),
        );

    // Generate OTP
    const {otp, hashedOTP, expires} = generateOTPData();

    // Save OTP
    const {error: updateError} = await supabase
        .from("user")
        .update({
            phone_otp: hashedOTP,
            phone_otp_expires: expires,
        })
        .eq("user_id", user.user_id);

    if (updateError)
        return next(new ApiError("حدث خطأ أثناء إنشاء رمز التحقق", 500));

    try {
        // Send WhatsApp OTP
        await sendOTP(phone, otp);
    } catch (error) {
        return next(
            new ApiError("فشل إرسال رمز التحقق عبر واتساب، حاول مرة أخرى", 500),
        );
    }

    res.status(200).json({
        status: "success",
        message: "تم إعادة إرسال رمز التحقق إلى رقم الواتساب",
    });
});

// @Desc Logout user and clear token cookie
// @Route POST : /api/auth/logout
// @Access Public
export const logout = AsyncHandler(async (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
    });

    res.status(200).json({
        status: "success",
        message: "تم تسجيل الخروج بنجاح",
    });
});

// @Desc Get current logged in user
// @Route GET : /api/auth/me
// @Access Private
export const getMe = AsyncHandler(async (req, res, next) => {

    // Get current user
    const {data: user, error} = await supabase

        .from("user")

        .select(
            `
            user_id,
            full_name,
            email,
            date_of_birth,
            gender,
            phone_number,
            role,
            is_active,
            created_at
        `,
        )

        .eq("user_id", req.user.user_id)

        .single();


    // User not found
    if (!user || error)

        return next(
            new ApiError(
                "المستخدم غير موجود",
                404
            )
        );


    // Response
    res.status(200).json({

        status: "success",

        message: "تم جلب بيانات المستخدم بنجاح",

        user,

    });

});

// ============ Change Phone Number to New One =============

// @Desc Change Phone Number
// @Route POST : /api/auth/change-phone
// @Access Private
export const changePhoneNumber = AsyncHandler(async (req, res, next) => {
    const {phone_number} = req.body;

    // Normalize phone
    const phone = normalizeYemenPhone(phone_number);

    // Check phone already exists
    const {data: existingUser} = await supabase
        .from("user")
        .select("user_id")
        .eq("phone_number", phone)
        .single();

    if (existingUser)
        return next(new ApiError("رقم الهاتف مستخدم بالفعل", 409));

    // Generate OTP
    const {otp, hashedOTP, expires} = generateOTPData();

    // Save new phone
    const {error} = await supabase
        .from("user")
        .update({
            new_phone_number: phone,
            phone_otp: hashedOTP,
            phone_otp_expires: expires,
        })
        .eq("user_id", req.user.user_id);

    if (error) return next(new ApiError("حدث خطأ أثناء حفظ البيانات", 500));

    try {
        await sendOTP(phone, otp);
    } catch (error) {
        return next(new ApiError("فشل إرسال رمز التحقق عبر واتساب", 500));
    }

    console.log(otp);
    
    res.status(200).json({
        status: "success",
        message: "تم إرسال رمز التحقق إلى رقم الهاتف الجديد",
    });
});


// @Desc Verify Changed Phone Number
// @Route POST : /api/auth/verify-change-phone
// @Access Private
export const verifyChangePhoneNumber = AsyncHandler(
    async (req, res, next) => {
        const {otp} = req.body;

        // Hash OTP
        const hashedOTP = hashOTP(otp);

        // Check user
        const {data: user, error} = await supabase
            .from("user")
            .select("*")
            .eq("user_id", req.user.user_id)
            .eq("phone_otp", hashedOTP)
            .gt("phone_otp_expires", new Date().toISOString())
            .single();

        if (!user || error)
            return next(
                new ApiError(
                    "رمز التحقق غير صحيح أو انتهت صلاحيته",
                    400,
                ),
            );

        // Update phone
        const {error: updateError} = await supabase
            .from("user")
            .update({
                phone_number: user.new_phone_number,
                new_phone_number: null,
                phone_otp: null,
                phone_otp_expires: null,
            })
            .eq("user_id", user.user_id);

        if (updateError)
            return next(
                new ApiError(
                    "حدث خطأ أثناء تغيير رقم الهاتف",
                    500,
                ),
            );

        res.status(200).json({
            status: "success",
            message: "تم تغيير رقم الهاتف بنجاح",
        });
    },
);

// @Desc Resend Change Phone OTP
// @Route POST : /api/auth/resend-change-phone-otp
// @Access Private
export const resendChangePhoneOTP = AsyncHandler(
    async (req, res, next) => {
        const {data: user, error} = await supabase
            .from("user")
            .select("*")
            .eq("user_id", req.user.user_id)
            .single();

        if (!user || error)
            return next(new ApiError("المستخدم غير موجود", 404));

        if (!user.new_phone_number)
            return next(
                new ApiError(
                    "لا يوجد طلب تغيير رقم هاتف",
                    400,
                ),
            );

        const {otp, hashedOTP, expires} = generateOTPData();

        await supabase
            .from("user")
            .update({
                phone_otp: hashedOTP,
                phone_otp_expires: expires,
            })
            .eq("user_id", user.user_id);

        await sendOTP(user.new_phone_number, otp);

        res.status(200).json({
            status: "success",
            message: "تم إعادة إرسال رمز التحقق",
        });
    },
);

// ============ Forgetten Password Code ===========

// @Desc Send reset password code to user WhatsApp
// @Route POST : /api/auth/forget-password
// @Access Public
export const forgetPassword = AsyncHandler(async (req, res, next) => {
    const {phone_number} = req.body;

    // Normalize phone
    const phone = normalizeYemenPhone(phone_number);

    // Check if user exists
    const {data: user, error} = await supabase
        .from("user")
        .select("*")
        .eq("phone_number", phone)
        .single();

    if (!user || error) return next(new ApiError("رقم الهاتف غير موجود", 404));

    // Check phone verified
    if (!user.phone_verified)
        return next(
            new ApiError("الحساب غير مفعل، يرجى تفعيل رقم الهاتف أولاً", 400),
        );

    // Generate OTP
    const {otp, hashedOTP, expires} = generateOTPData();

    // Save OTP
    const {error: updateError} = await supabase
        .from("user")
        .update({
            password_reset_code: hashedOTP,
            password_reset_expires: expires,
            password_reset_verified: false,
        })
        .eq("user_id", user.user_id);

    if (updateError)
        return next(new ApiError("حدث خطأ أثناء إنشاء رمز التحقق", 500));

    try {
        // Send WhatsApp OTP
        await sendOTP(phone, otp);
    } catch (error) {
        // Rollback
        await supabase
            .from("user")
            .update({
                password_reset_code: null,
                password_reset_expires: null,
                password_reset_verified: false,
            })
            .eq("user_id", user.user_id);

        return next(
            new ApiError("فشل إرسال رمز التحقق عبر واتساب، حاول مرة أخرى", 500),
        );
    }

    console.log(otp);
    res.status(200).json({
        status: "success",
        message: "تم إرسال رمز التحقق إلى رقم الواتساب الخاص بك",
    });
});

// @Desc User sends reset password code to verify it
// @Route POST : /api/auth/verify-reset-code
// @Access Public
export const verifyPasswordResetCode = AsyncHandler(async (req, res, next) => {
    const {phone_number, resetCode} = req.body;

    // Normalize phone
    const phone = normalizeYemenPhone(phone_number);

    // Hash reset code
    const hashedPasswordResetCode = hashOTP(resetCode);

    // Check user + code + expiration
    const {data: user, error} = await supabase
        .from("user")
        .select("*")
        .eq("phone_number", phone)
        .eq("password_reset_code", hashedPasswordResetCode)
        .gt("password_reset_expires", new Date().toISOString())
        .single();

    if (!user || error)
        return next(
            new ApiError(
                "رمز التحقق غير صالح أو انتهت صلاحيته، حاول مرة أخرى",
                400,
            ),
        );

    // Mark code as verified
    const {error: updateError} = await supabase
        .from("user")
        .update({
            password_reset_verified: true,
        })
        .eq("user_id", user.user_id);

    if (updateError) return next(new ApiError("حدث خطأ، حاول مرة أخرى", 400));

    res.status(200).json({
        status: "success",
        message: "تم التحقق من رمز الاستعادة بنجاح",
    });
});

// @Desc Reset user password
// @Route POST : /api/auth/reset-password
// @Access Public
export const resetPassword = AsyncHandler(async (req, res, next) => {
    const {phone_number, newPassword} = req.body;

    // Normalize phone
    const phone = normalizeYemenPhone(phone_number);

    // Check user
    const {data: user, error} = await supabase
        .from("user")
        .select("*")
        .eq("phone_number", phone)
        .single();

    if (!user || error)
        return next(new ApiError("المستخدم غير موجود، حاول مرة أخرى", 404));

    // Check verification
    if (!user.password_reset_verified)
        return next(
            new ApiError("رمز التحقق غير صالح أو لم يتم التحقق منه", 401),
        );

    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    const {data: updateUser, error: updateError} = await supabase
        .from("user")
        .update({
            password: hashedPassword,

            password_reset_code: null,
            password_reset_expires: null,
            password_reset_verified: false,

            password_changed_at: new Date(),
        })
        .eq("phone_number", phone)
        .select("*")
        .single();

    if (!updateUser || updateError)
        return next(
            new ApiError("حدث خطأ أثناء تغيير كلمة المرور، حاول مرة أخرى", 400),
        );

    res.status(200).json({
        status: "success",
        message: "تم تغيير كلمة المرور بنجاح",
    });
});
