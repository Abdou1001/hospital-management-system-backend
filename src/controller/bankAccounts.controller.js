import {supabase} from "../config/supabase.js";
import AsyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";

import {deleteCache, getCache, setCache} from "../services/cache.service.js";
import {CACHE_KEYS, CACHE_TTL} from "../config/cache.js";
import {STORAGE_BUCKETS} from "../config/storage.js";

import {getPublicImageUrl} from "../services/storage.service.js";
import {
    replaceImage,
    rollbackUploadedImage,
    uploadAndProcessImage,
} from "../services/imageUpload.service.js";

// ======================================================
// GET ALL BANK ACCOUNTS
// GET /api/bank-accounts
// Public
// ======================================================

export const getBankAccountsInfo = AsyncHandler(async (req, res, next) => {
    const cacheKey = CACHE_KEYS.BANK_ACCOUNTS;

    // Check Redis
    const cachedBankAccounts = await getCache(cacheKey);

    if (cachedBankAccounts) {
        const results = cachedBankAccounts.map((account) => ({
            ...account,

            path_image: getPublicImageUrl(
                STORAGE_BUCKETS.BANK_ACCOUNTS,
                account.path_image,
            ),
        }));

        return res.status(200).json({
            status: "success",
            message: "تم جلب الحسابات البنكية من Redis",
            results,
        });
    }

    // Get from Supabase
    const {data: bankAccounts, error} = await supabase
        .from("bank_accounts")
        .select("*")
        .order("bank_account_id", {
            ascending: true,
        });

    if (error) {
        return next(new ApiError("حدث خطأ أثناء جلب الحسابات البنكية", 500));
    }

    // Save in Redis
    await setCache(cacheKey, bankAccounts, CACHE_TTL.BANK_ACCOUNTS);

    // Convert image path
    const results = bankAccounts.map((account) => ({
        ...account,

        path_image: getPublicImageUrl(
            STORAGE_BUCKETS.BANK_ACCOUNTS,
            account.path_image,
        ),
    }));

    res.status(200).json({
        status: "success",
        message: "تم جلب الحسابات البنكية بنجاح",
        results,
    });
});

// ======================================================
// GET ONE BANK ACCOUNT
// GET /api/bank-accounts/:id
// Admin
// ======================================================

export const getOneBankAccountInfo = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const cacheKey = CACHE_KEYS.BANK_ACCOUNT(id);

    // Check Redis
    const cachedAccount = await getCache(cacheKey);

    if (cachedAccount) {
        const result = {
            ...cachedAccount,

            path_image: getPublicImageUrl(
                STORAGE_BUCKETS.BANK_ACCOUNTS,
                cachedAccount.path_image,
            ),
        };

        return res.status(200).json({
            status: "success",
            message: "تم جلب الحساب البنكي من Redis",
            results: result,
        });
    }

    // Get from Supabase
    const {data: account, error} = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("bank_account_id", id)
        .single();

    if (error || !account) {
        return next(new ApiError("الحساب البنكي غير موجود", 404));
    }

    // Save Cache
    await setCache(cacheKey, account, CACHE_TTL.BANK_ACCOUNTS);

    const result = {
        ...account,

        path_image: getPublicImageUrl(
            STORAGE_BUCKETS.BANK_ACCOUNTS,
            account.path_image,
        ),
    };

    res.status(200).json({
        status: "success",
        message: "تم جلب الحساب البنكي بنجاح",
        results: result,
    });
});

// ======================================================
// CREATE BANK ACCOUNT
// POST /api/bank-accounts
// Admin
// ======================================================

// @Desc Insert Bank Account
// @Route POST : /api/bank-accounts/
// @Access private (Admin)

export const insertBankAccount = AsyncHandler(async (req, res, next) => {
    const {name, account_number} = req.body;

    let path_image = null;

    try {
        // Upload image to Supabase Storage
        path_image = await uploadAndProcessImage(
            STORAGE_BUCKETS.BANK_ACCOUNTS,
            req.file,
        );

        // Insert into database
        const {data: account, error} = await supabase
            .from("bank_accounts")
            .insert({
                name,
                account_number,
                path_image,
                is_active: true,
            })
            .select("*")
            .single();

        if (error) {
            throw new ApiError("حدث خطأ أثناء إضافة الحساب البنكي", 400);
        }

        // Delete cache
        await deleteCache(CACHE_KEYS.BANK_ACCOUNTS);

        // Public image URL
        account.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.BANK_ACCOUNTS,
            account.path_image,
        );

        res.status(201).json({
            status: "success",
            message: "تم إضافة الحساب البنكي بنجاح",
            results: account,
        });
    } catch (err) {
        // If database insertion fails after uploading image
        // delete uploaded image
        await rollbackUploadedImage(STORAGE_BUCKETS.BANK_ACCOUNTS, path_image);

        return next(err);
    }
});

// ======================================================
// UPDATE BANK ACCOUNT
// PUT /api/bank-accounts/:id
// Admin
// ======================================================

// @Desc Update Bank Account
// @Route PUT : /api/bank-accounts/:id
// @Access private (Admin)

export const updateBankAccount = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    const {
        name,
        account_number,
    } = req.body;

    let newPathImage = null;

    try {
        // Get old account
        const {data: oldAccount, error: getError} = await supabase
            .from("bank_accounts")
            .select("*")
            .eq("bank_account_id", id)
            .single();

        if (getError || !oldAccount) {
            return next(
                new ApiError(
                    "الحساب البنكي غير موجود",
                    404,
                ),
            );
        }

        /*
         * البيانات التي سيتم تعديلها
         */
        const updateData = {
            name,
            account_number,
        };

        /*
         * إذا أرسل المستخدم صورة جديدة
         */
        if (req.file) {
            newPathImage = await replaceImage(
                STORAGE_BUCKETS.BANK_ACCOUNTS,
                oldAccount.path_image,
                req.file,
            );

            updateData.path_image = newPathImage;
        }

        /*
         * Update database
         */
        const {data: account, error} = await supabase
            .from("bank_accounts")
            .update(updateData)
            .eq("bank_account_id", id)
            .select("*")
            .single();

        if (error || !account) {
            throw new ApiError(
                "حدث خطأ أثناء تعديل الحساب البنكي",
                400,
            );
        }

        /*
         * Delete cache
         */
        await deleteCache(CACHE_KEYS.BANK_ACCOUNTS);

        await deleteCache(
            CACHE_KEYS.BANK_ACCOUNT(id),
        );

        /*
         * Public image URL
         */
        account.path_image = getPublicImageUrl(
            STORAGE_BUCKETS.BANK_ACCOUNTS,
            account.path_image,
        );

        res.status(200).json({
            status: "success",
            message: "تم تعديل الحساب البنكي بنجاح",
            results: account,
        });

    } catch (err) {

        /*
         * إذا حدث خطأ بعد رفع الصورة الجديدة
         */
        if (newPathImage) {
            await rollbackUploadedImage(
                STORAGE_BUCKETS.BANK_ACCOUNTS,
                newPathImage,
            );
        }

        return next(err);
    }
});

// ======================================================
// TOGGLE STATUS
// PATCH /api/bank-accounts/:id/status
// Admin
// ======================================================

// @Desc Toggle Bank Account Status
// @Route PATCH : /api/bank-accounts/:id/status
// @Access private (Admin)

export const toggleBankAccountStatus = AsyncHandler(
    async (req, res, next) => {
        const {id} = req.params;

        const {data: account, error: getError} = await supabase
            .from("bank_accounts")
            .select("is_active")
            .eq("bank_account_id", id)
            .single();

        if (getError || !account) {
            return next(
                new ApiError(
                    "الحساب البنكي غير موجود",
                    404,
                ),
            );
        }

        const newStatus = !account.is_active;

        const {data: updatedAccount, error} = await supabase
            .from("bank_accounts")
            .update({
                is_active: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq("bank_account_id", id)
            .select("*")
            .single();

        if (error || !updatedAccount) {
            return next(
                new ApiError(
                    "حدث خطأ أثناء تغيير حالة الحساب البنكي",
                    400,
                ),
            );
        }

        // Delete cache
        await deleteCache(CACHE_KEYS.BANK_ACCOUNTS);

        await deleteCache(
            CACHE_KEYS.BANK_ACCOUNT(id),
        );

        res.status(200).json({
            status: "success",
            message: newStatus
                ? "تم تفعيل الحساب البنكي"
                : "تم تعطيل الحساب البنكي",
            results: updatedAccount,
        });
    },
);

// @Desc Delete Bank Account
// @Route DELETE : /api/bank-accounts/:id
// @Access private (Admin)

export const deleteBankAccount = AsyncHandler(async (req, res, next) => {
    const {id} = req.params;

    // Get account first
    const {data: account, error: getError} = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("bank_account_id", id)
        .single();

    if (getError || !account) {
        return next(
            new ApiError(
                "الحساب البنكي غير موجود",
                404,
            ),
        );
    }

    // Delete account from database
    const {error: deleteError} = await supabase
        .from("bank_accounts")
        .delete()
        .eq("bank_account_id", id);

    if (deleteError) {
        return next(
            new ApiError(
                "حدث خطأ أثناء حذف الحساب البنكي",
                500,
            ),
        );
    }

    // Delete image from Supabase Storage
    if (account.path_image) {
        const {error: imageError} = await supabase.storage
            .from(STORAGE_BUCKETS.BANK_ACCOUNTS)
            .remove([account.path_image]);

        if (imageError) {
            console.error(
                "Failed to delete bank account image:",
                imageError,
            );
        }
    }

    // Delete cache
    await deleteCache(CACHE_KEYS.BANK_ACCOUNTS);

    await deleteCache(
        CACHE_KEYS.BANK_ACCOUNT(id),
    );

    res.status(200).json({
        status: "success",
        message: "تم حذف الحساب البنكي بنجاح",
    });
});
