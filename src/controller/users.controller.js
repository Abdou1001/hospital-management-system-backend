import { supabase } from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";
import bcrypt from "bcrypt";


const selectedColumns = `user_id,full_name,email,role,age,gender,phone_number,created_at,is_active`;

// @Desc Get all users
// @Route GET : /api/users
// @Access Private (Admin)
export const getUsersInfo = AsyncHandler(async (req, res, next) => {

    const { page, limit, from, to } = paginate(req);

    const {
        keyword = "",
        role,
        gender,
        is_active,
        sort = "-created_at"
    } = req.query;

    let query = supabase
        .from("user")
        .select(selectedColumns, { count: "exact" })

        .or(`full_name.ilike.%${keyword}%,email.ilike.%${keyword}%,phone_number.ilike.%${keyword}%`);

    // Filter by role
    if (role)
        query = query.eq(
            "role",
            role
        );

    // Filter by gender
    if (gender)
        query = query.eq(
            "gender",
            gender
        );

    // Filter by active status
    if (is_active)
        query = query.eq(
            "is_active",
            is_active
        );

    // Sorting Descending
    if (sort.startsWith("-")) {

        query = query.order(
            sort.substring(1),
            {
                ascending: false
            }
        );

    }
    // Sorting Ascending
    else {

        query = query.order(
            sort,
            {
                ascending: true
            }
        );

    }

    const { data: users, error, count } = await query.range(from, to);

    if (error)
        return next(
            new ApiError(
                "حدث خطأ أثناء جلب المستخدمين",
                500
            )
        );

    res.status(200).json({

        status: "success",

        pagination:
            paginationResult(
                page,
                limit,
                count
            ),

        results:
            users

    });

});


// @Desc Get one user
// @Route GET : /api/users/:id
// @Access Private (Admin)
export const getOneUserInfo = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const {
        data: user,
        error
    } = await supabase

        .from("user")

        .select(selectedColumns)

        .eq(
            "user_id",
            id
        )

        .single();


    if (!user || error)
        return next(
            new ApiError(
                "المستخدم غير موجود",
                404
            )
        );


    res.status(200).json({

        status: "success",

        results:
            user

    });

});


// @Desc Update one user
// @Route PUT : /api/users/:id
// @Access Private (Admin)
export const updateUser = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const {
        full_name,
        age,
        gender,
        phone_number
    } = req.body;

    const { data: user, error } = await supabase
        .from("user")

        .update({
            full_name,
            age,
            gender,
            phone_number
        })

        .eq(
            "user_id",
            id
        )

        .select(selectedColumns)

        .single();


    if (!user || error)
        return next(
            new ApiError(
                "حدث خطأ أثناء تحديث المستخدم",
                400
            )
        );

    res.status(200).json({

        status: "success",

        results:
            user

    });

});


// @Desc Change user status
// @Route PATCH : /api/users/:id/status
// @Access Private (Admin)
export const changeUserStatus = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;

    const { data: currentUser, error } = await supabase
        .from("user")

        .select("user_id,is_active")

        .eq(
            "user_id",
            id
        )

        .single();


    if (!currentUser || error)
        return next(
            new ApiError(
                "المستخدم غير موجود",
                404
            )
        );

    if (req.user.user_id == id)
        return next(
            new ApiError(
                "لا يمكنك توقيف حسابك",
                400
            )
        );


    const { data: user, error: updateError } = await supabase
        .from("user")

        .update({
            is_active:
                currentUser.is_active === "active"
                    ? "inactive"
                    : "active"
        })

        .eq(
            "user_id",
            id
        )

        .select(selectedColumns)

        .single();


    if (!user || updateError)
        return next(
            new ApiError(
                "حدث خطأ أثناء تغيير حالة المستخدم",
                400
            )
        );


    res.status(200).json({

        status: "success",

        results:
            user

    });

});


// @Desc Change user role
// @Route PATCH : /api/users/:id/role
// @Access Private (Admin)
export const changeUserRole = AsyncHandler(async (req, res, next) => {

    const { id } = req.params;
    const { role } = req.body;

    if (req.user.user_id == id)
        return next(
            new ApiError(
                "لا يمكنك تغيير صلاحيتك",
                400
            )
        );

    const { data: user, error } = await supabase
        .from("user")

        .update({
            role
        })

        .eq(
            "user_id",
            id
        )

        .select(selectedColumns)

        .single();


    if (!user || error)
        return next(
            new ApiError(
                "حدث خطأ أثناء تغيير صلاحية المستخدم",
                400
            )
        );


    res.status(200).json({

        status: "success",

        results:
            user

    });

});




// for user acess

// @Desc Get my profile
// @Route GET : /api/users/profile
// @Access Private
export const getMyProfile = AsyncHandler(async (req, res, next) => {

    console.log(req.user.user_id)
    console.log("CODE...")

    const {
        data: user,
        error
    } = await supabase

        .from("user")

        .select(selectedColumns)

        .eq(
            "user_id",
            req.user.user_id
        )

        .single();


    if (!user || error)
        return next(
            new ApiError(
                "المستخدم غير موجود",
                404
            )
        );


    res.status(200).json({

        status: "success",

        results:
            user

    });

});

// @Desc Update my profile
// @Route PUT : /api/users/profile
// @Access Private
export const updateMyProfile = AsyncHandler(async (req, res, next) => {

    const {
        full_name,
        age,
        gender,
        phone_number
    } = req.body;

    const {
        data: user,
        error
    } = await supabase

        .from("user")

        .update({
            full_name,
            age,
            gender,
            phone_number
        })

        .eq(
            "user_id",
            req.user.user_id
        )

        .select(selectedColumns)

        .single();


    if (!user || error)
        return next(
            new ApiError(
                "حدث خطأ أثناء تحديث الملف الشخصي",
                400
            )
        );


    res.status(200).json({

        status: "success",

        message:
            "تم تحديث الملف الشخصي بنجاح",

        results:
            user

    });

});


// @Desc Change my password
// @Route PATCH : /api/users/change-password
// @Access Private
export const changeMyPassword = AsyncHandler(async (req, res, next) => {

    const { current_password, new_password } = req.body;

    const { data: user, error } = await supabase
        .from("user")

        .select("*")

        .eq(
            "user_id",
            req.user.user_id
        )

        .single();


    if (!user || error)
        return next(
            new ApiError(
                "المستخدم غير موجود",
                404
            )
        );


    const correctPassword = await bcrypt.compare(current_password, user.password);

    if (!correctPassword)
        return next(
            new ApiError(
                "كلمة المرور الحالية غير صحيحة",
                400
            )
        );


    const hashedPassword = await bcrypt.hash(new_password, 12);


    const { error: updateError } = await supabase
        .from("user")
        .update({
            password: hashedPassword,
            password_changed_at: new Date()
        })

        .eq(
            "user_id",
            req.user.user_id
        );


    if (updateError)
        return next(
            new ApiError(
                "حدث خطأ أثناء تغيير كلمة المرور",
                500
            )
        );


    res.status(200).json({

        status: "success",

        message:
            "تم تغيير كلمة المرور بنجاح"

    });

});