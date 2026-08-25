# Reusable Reference Patterns

This document details 10 reusable implementation patterns from the project codebase.

---

## 1. Cache-Aside Pattern (Lazy Loading)

### Description
Fetches data from Redis first using a dynamically built key. On cache hit, transforms public image URLs and returns immediately. On cache miss, queries Supabase, stores the raw results in Redis (without public URLs), transforms image URLs, and responds.

### Example Code
```javascript
export const getDoctorsInfo = AsyncHandler(async (req, res, next) => {
    const { page, limit, from, to } = paginate(req);
    const { keyword = "", status, sort = "full_name" } = req.query;

    // Build Cache Key from all query parameters
    const cacheKey = `doctors:page=${page}:limit=${limit}:keyword=${keyword}:status=${status || "all"}:sort=${sort}`;

    // 1. Check Redis Cache
    const cachedDoctors = await getCache(cacheKey);

    if (cachedDoctors) {
        cachedDoctors.results.forEach((doctor) => {
            doctor.path_image = getPublicImageUrl(STORAGE_BUCKETS.DOCTORS, doctor.path_image);
        });

        return res.status(200).json({
            status: "success",
            message: "تم جلب البيانات من Redis",
            pagination: cachedDoctors.pagination,
            results: cachedDoctors.results,
        });
    }

    // 2. Fetch from Database
    let query = supabase.from("doctor").select("*", { count: "exact" });
    const { data: doctors, error, count } = await query.range(from, to);

    if (error || !doctors) return next(new ApiError("حدث خطأ أثناء جلب الأطباء", 500));

    const pagination = paginationResult(page, limit, count);

    // 3. Save to Redis Cache
    await setCache(cacheKey, { pagination, results: doctors }, CACHE_TTL.DOCTORS);

    // 4. Transform Image Paths to Public URLs
    doctors.forEach((doctor) => {
        doctor.path_image = getPublicImageUrl(STORAGE_BUCKETS.DOCTORS, doctor.path_image);
    });

    res.status(200).json({
        status: "success",
        message: "تم جلب الأطباء بنجاح",
        pagination,
        results: doctors,
    });
});
```

---

## 2. Cache Invalidation Pattern

### Description
Invalidates relevant Redis cache keys whenever data is added, updated, or deleted. Uses pattern-based key deletion (`deleteByPattern`) for list queries and individual key deletion (`deleteCache`) for single entities and dashboard statistics.

### Example Code
```javascript
// Invalidate list queries matching pattern
await deleteByPattern("doctors:*");

// Invalidate single entity key
await deleteCache(CACHE_KEYS.DOCTOR(id));

// Invalidate dashboard statistics cache
await deleteCache(CACHE_KEYS.DASHBOARD);
```

---

## 3. Image Rollback Pattern

### Description
Ensures clean state handling during record insertion. The image is processed and uploaded to storage before executing the database query. If the database insertion fails, the uploaded image is safely deleted in the `catch` block.

### Example Code
```javascript
export const insertDoctor = AsyncHandler(async (req, res, next) => {
    let path_image = null;

    try {
        // Upload image first
        path_image = await uploadAndProcessImage(
            STORAGE_BUCKETS.DOCTORS,
            req.file,
        );

        // Execute DB insertion
        const { data: doctor, error } = await supabase
            .from("doctor")
            .insert({ ...req.body, path_image })
            .select("*")
            .single();

        if (error) throw new ApiError("حدث خطأ أثناء إضافة الطبيب", 400);

        await deleteByPattern("doctors:*");
        await deleteCache(CACHE_KEYS.DASHBOARD);

        doctor.path_image = getPublicImageUrl(STORAGE_BUCKETS.DOCTORS, doctor.path_image);

        res.status(201).json({ status: "success", results: doctor });
    } catch (err) {
        // Rollback uploaded image on DB error
        await rollbackUploadedImage(STORAGE_BUCKETS.DOCTORS, path_image);
        return next(err);
    }
});
```

---

## 4. `replaceImage` Service Pattern

### Description
Encapsulates atomic image updates. If a new file is uploaded, it processes and uploads the new image, executes the database update callback (`action`), and deletes the old image only after the database operation succeeds.

### Example Code
```javascript
export const updateDoctor = AsyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const { data: currentDoctor, error: currentError } = await supabase
        .from("doctor")
        .select("*")
        .eq("doctor_id", id)
        .single();

    if (!currentDoctor || currentError) return next(new ApiError("الطبيب غير موجود", 404));

    const doctor = await replaceImage({
        bucket: STORAGE_BUCKETS.DOCTORS,
        currentImage: currentDoctor.path_image,
        file: req.file,
        action: async (path_image) => {
            const { data, error } = await supabase
                .from("doctor")
                .update({ ...req.body, path_image })
                .eq("doctor_id", id)
                .select("*")
                .single();

            if (!data || error) throw new ApiError("حدث خطأ أثناء تعديل بيانات الطبيب", 400);
            return data;
        },
    });

    await deleteByPattern("doctors:*");
    await deleteCache(CACHE_KEYS.DOCTOR(id));

    doctor.path_image = getPublicImageUrl(STORAGE_BUCKETS.DOCTORS, doctor.path_image);
    res.status(200).json({ status: "success", results: doctor });
});
```

---

## 5. Pagination Pattern

### Description
Computes query offset parameters (`from`, `to`) for Supabase queries and generates structured pagination metadata.

### Example Code
```javascript
// utils/pagination.js
export const paginate = (req) => {
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return { page, limit, from, to };
};

export const paginationResult = (page, limit, count) => {
    const totalPages = Math.ceil(count / limit);
    return {
        page,
        limit,
        totalResults: count,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
    };
};
```

---

## 6. `allowedTo` Authorization Pattern

### Description
Higher-order middleware factory that restricts access to endpoints based on allowed user roles attached to `req.user.role`.

### Example Code
```javascript
// middlewares/auth.middleware.js
export const allowedTo = (...roles) => AsyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return next(new ApiError("ليس لديك صلاحية للوصول", 403));
    }
    next();
});

// Route Usage:
router.post("/", protect, allowedTo("admin"), insertDoctor);
```

---

## 7. Parallel Queries with `Promise.all` Pattern

### Description
Executes multiple independent database queries concurrently to optimize execution time, such as aggregating dashboard statistics.

### Example Code
```javascript
const [
    { count: numberUsers, error: userError },
    { count: numberDoctors, error: doctorError },
    { count: numberDepartments, error: departmentError },
] = await Promise.all([
    supabase.from("user").select("*", { count: "exact", head: true }),
    supabase.from("doctor").select("*", { count: "exact", head: true }),
    supabase.from("department").select("*", { count: "exact", head: true }),
]);

if (userError) return next(new ApiError("حدث خطأ أثناء جلب عدد المستخدمين", 500));
```

---

## 8. `maybeSingle` Uniqueness Checking Pattern

### Description
Queries Supabase for a single matching record using `.maybeSingle()`, which returns `null` instead of throwing an error if no record is found.

### Example Code
```javascript
const { data: existingUser } = await supabase
    .from("user")
    .select("user_id")
    .eq("phone_number", phone)
    .maybeSingle();

if (existingUser) {
    return next(new ApiError("رقم الهاتف مسجل بالفعل", 409));
}
```

---

## 9. OTP Generation and SHA-256 Hashing Pattern

### Description
Generates a random 6-digit plain text OTP for the user while storing its SHA-256 hash in the database along with an expiration timestamp.

### Example Code
```javascript
// utils/otp.js
import crypto from "crypto";

export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashOTP = (otp) => {
    return crypto.createHash("sha256").update(otp).digest("hex");
};

export const generateOTPData = (minutes = 10) => {
    const otp = generateOTP();
    return {
        otp,                                                            // Sent to user (WhatsApp)
        hashedOTP: hashOTP(otp),                                        // Saved in DB
        expires: new Date(Date.now() + minutes * 60 * 1000),
    };
};
```

---

## 10. Services as Exported Named Functions Pattern

### Description
Services export utility functions directly as named exports rather than creating object instances or classes, keeping service calls functional and concise.

### Example Code
```javascript
// services/cache.service.js
import { redis } from "../config/redis.js";

export const getCache = async (key) => {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
};

export const setCache = async (key, value, ttl = 3600) => {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
};

export const deleteCache = async (key) => {
    await redis.del(key);
};

export const deleteByPattern = async (pattern) => {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
};
```
