// Database Connection
import { supabase } from "../config/supabase.js";

import AsyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
// encription tools
import bcrypt from "bcrypt";
import crypto from "crypto"
// send email to rest password
import { sendEmail } from "../utils/sendEmail.js";
import { resetPasswordTemplate } from "../utils/emailTemplate.js";



// @Desc Makes Toke for login yours
// @Param Takes user_هd and role to make token
const createToken = (payload) => jwt.sign(
    payload,
    process.env.SECRET_KEY_JWT,
    { expiresIn: process.env.JWT_EXPIRES_IN }
)

// @Desc Makes cookie to put toke on it for premissions
//      (this function is using createToken() to generate token)
// @Param Takes user to create token statusCode to put if success res to send response
export const createSendToken = (user, statusCode, res) => {

    // Generate token
    const token = createToken(
        {
            user_id: user.user_id,
            role: user.role,
        }
    );

    // delete password for enhance secure
    delete user.password;

    // Make cookie
    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge:
            7 * 24 * 60 * 60 * 1000,
    });

    // send response
    res.status(statusCode).json({
        status: "success",
        user,
    });
};


// ===== auth opertions ====

// @Desc Login Controller, Check if email exist in db then Check from Password
// @Route POST : api/auth/login
// @Access Public 
export const login = AsyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
        .from("user")
        .select("*")
        .eq("email", email)
        .single();

    if (error || !user || !(await bcrypt.compare(password, user?.password || "")))
        return next(new ApiError("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401))

    if (user.is_Active == "inactive")
        return next(new ApiError("الحساب موقف من الادارة ارجاء التواصل مع الادارة لفتح الحساب", 401))


    // generetes token and put it in cookies
    createSendToken(
        user,
        200,
        res
    );

});


// @Desc register Controller, Create New account for user
// @Route POST : api/auth/register
// @Access Public 
export const register = AsyncHandler(async (req, res, next) => {

    // Destructuring
    const {
        full_name,
        email,
        password,
        age,
        gender,
        phone_number
    } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const { data: user, error } = await supabase
        .from("user")
        .insert([
            {
                full_name,
                email,

                password: hashedPassword,

                age,
                gender,
                phone_number,

                role: "user",

                created_at: new Date(),

                is_active: "active"
            }
        ])
        .select("*")
        .single();

    // Handle DB error
    if (error)
        return next(new ApiError("حدث خطاء أثناء إنشاء حساب، حاول مرة اخرى", 400));

    // Send token in cookie
    createSendToken(user, 201, res);

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





// ===== Forgetten Password Code =====

// @Desc Send reset password code to user email
// @Route POST : /api/auth/forget-password
// @Access Public
export const forgetPassword = AsyncHandler(async (req, res, next) => {

    const { email } = req.body;

    // Check if user exists
    const { data: user, error } = await supabase
        .from("user")
        .select("*")
        .eq("email", email)
        .single();

    if (error || !user)
        return next(new ApiError("البريد الإلكتروني غير موجود", 404));


    // Generate 6 digit code
    const passwordResetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash reset code
    const hashedPasswordResetCode = crypto
        .createHash("sha256")
        .update(passwordResetCode)
        .digest("hex");


    // Save hashed code in DB
    const { error: updateError } = await supabase
        .from("user")
        .update({
            password_reset_code:
                hashedPasswordResetCode,
            password_reset_expires:
                new Date(
                    Date.now() + 10 * 60 * 1000
                ),
            password_reset_verified:
                false,
        })
        .eq("email", email);

    if (updateError)
        return next(new ApiError("حدث خطأ أثناء حفظ الكود", 500));


    // Send email here
    // Desgin tempalte for Email message
    const message = resetPasswordTemplate(passwordResetCode);

    try {
        await sendEmail({
            to: user.email,
            subject:
                "إعادة تعيين كلمة المرور - Hospital System",
            html: message,
        });
    } catch (error) {
        const { error: updateError } = await supabase
            .from("user")
            .update({
                password_reset_code: null,
                password_reset_expires: null,
                password_reset_verified: null,
            })
            .eq("email", email);

        return next(
            new ApiError(
                "فشل إرسال البريد الإلكتروني، حاول مرة أخرى",
                500
            )
        )
    }


    res.status(200).json({
        status: "success",
        message: `تم إرسال كود على البريد الالكتروني ${user.email}\n ادخل الكود المرسل هنا`,
    });

});


// @Desc User sends reset password code to verify it
// @Route POST : /api/auth/verify-reset-code
// @Access Public
export const verifyPasswordResetCode = AsyncHandler(async (req, res, next) => {
    const { resetCode } = req.body;

    const hashedPasswordResetCode = crypto
        .createHash("sha256")
        .update(resetCode)
        .digest("hex")

    const { data: user, error } = await supabase
        .from("user")
        .select("*")
        .eq("password_reset_code", hashedPasswordResetCode)
        .gt("password_reset_expires", new Date().toISOString())
        .single()

    if (!user || error)
        return next(new ApiError("الكود غير صالح أو انتهت صلاحيته حاول مرة اخرى", 400))


    const { data: update, error: updateError } = await supabase
        .from("user")
        .update(
            {
                "password_reset_verified": true,
            }
        )
        .eq("user_id", user.user_id)
        .select("*")


    if (updateError)
        return next(new ApiError("حدث خطأ، حاول مرة أخرى", 400))

    res.status(200).json({ message: "تم التحقق من الكود بنجاح" })
})


// @Desc Reset password 
// @Route POST : /api/auth/reset-password
// @Access Public
export const resetPassword = AsyncHandler(async (req, res, next) => {
    const { email, newPassword } = req.body


    const { data: user, error } = await supabase
        .from("user")
        .select('*')
        .eq("email", email)
        .single()


    if (!user || error)
        return next(new ApiError("المستخدم غير موجود حاول مرة اخرى", 404))

    if (!user.password_reset_verified)
        return next(new ApiError("كود التفعيل انتهى او غير فعال", 401))

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    const { data: updateUser, error: updateError } = await supabase
        .from("user")
        .update(
            {
                "password": hashedPassword,
                "password_reset_code": null,
                "password_reset_expires": null,
                "password_reset_verified": false,
                "password_changed_at": new Date()
            }
        )
        .eq("email", email)
        .select("*")
        .single()

    if (!updateUser || updateError)
        return next(new ApiError("المستخدم غير موجود حاول مرة اخرى", 404))

    res.status(200).json({ message: "تم تغيير كلمة المرور بنجاح" })
})