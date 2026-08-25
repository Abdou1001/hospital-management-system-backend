# 📋 تقرير التحليل الشامل — Hospital Management System Backend

> **ملاحظة**: هذا التقرير يستخرج الأنماط والاتفاقيات الموجودة في المشروع كما هي، دون اقتراح أي تحسينات.

---

## 1. هيكل المجلدات (Folder Structure)

```
BackEnd/
├── src/
│   ├── server.js                 ← نقطة الدخول، تشغيل السيرفر
│   ├── app.js                    ← إعداد Express، تسجيل الـ middlewares والـ routes
│   ├── config/
│   │   ├── supabase.js           ← إنشاء عميل Supabase
│   │   ├── redis.js              ← إنشاء عميل Redis
│   │   ├── cache.js              ← ثوابت مفاتيح الكاش وصلاحية التخزين
│   │   └── storage.js            ← أسماء Buckets التخزين
│   ├── controller/               ← منطق المعالجة (10 ملفات)
│   ├── routes/                   ← تعريف المسارات (10 ملفات)
│   ├── middlewares/              ← الـ middlewares (6 ملفات)
│   ├── validations/              ← مخططات التحقق بـ Zod (9 ملفات)
│   ├── services/                 ← خدمات خارجية (4 ملفات)
│   ├── utils/                    ← أدوات مساعدة (8 ملفات)
│   └── uploads/                  ← مجلد فارغ (مخصص للرفع المحلي)
├── .env
├── package.json
├── Dockerfile
└── docker-compose.yml
```

**الملاحظة**: لا يوجد مجلد `models/` لأن قاعدة البيانات مُدارة بـ Supabase (خارجية)، وبالتالي لا توجد تعريفات ORM محلية.

---

## 2. الـ Architecture المستخدم

المشروع يتبع نمط **Layered Architecture** (معمارية الطبقات) بالتقسيم التالي:

```
Request → Route → Middleware Chain → Controller → Service/Utils → Supabase/Redis
```

### طبقات المشروع:

| الطبقة | المجلد | المسؤولية |
|--------|--------|-----------|
| Transport | `routes/` | استقبال الطلبات، تطبيق الـ middlewares، توجيه الـ controller |
| Business Logic | `controller/` | منطق التطبيق الرئيسي |
| External Services | `services/` | التعامل مع Redis، Supabase Storage، WhatsApp |
| Utilities | `utils/` | دوال مساعدة قابلة لإعادة الاستخدام |
| Configuration | `config/` | إعداد الاتصالات بالخدمات الخارجية |

**قرار معماري مهم**: لا يوجد فصل بين Controller وService Layer للمنطق التجاري — المنطق الكامل موجود داخل الـ Controller مباشرةً.

---

## 3. Controllers

### نمط الكتابة العام:

كل controller ملف مستقل يُصدّر (export) دوال named بصيغة `AsyncHandler`.

**نمط ثابت في كل دالة GET:**
```javascript
// 1. Pagination
const {page, limit, from, to} = paginate(req);

// 2. Filters from query
const { keyword = "", status, sort = "..." } = req.query;

// 3. Build Cache Key
const cacheKey = `entity:page=...:filter=...`;

// 4. Check Cache
const cached = await getCache(cacheKey);
if (cached) { /* transform + return */ }

// 5. Build Query (Supabase)
let query = supabase.from("table").select("...", { count: "exact" });

// 6. Apply Filters
if (status) query = query.eq("status", status);

// 7. Apply Sorting
query = query.order(sort.startsWith("-") ? sort.substring(1) : sort, {
    ascending: !sort.startsWith("-"),
});

// 8. Execute
const { data, error, count } = await query.range(from, to);

// 9. Save Cache
await setCache(cacheKey, { pagination, results: data }, TTL);

// 10. Transform images
data.forEach(item => {
    item.path_image = getPublicImageUrl(BUCKET, item.path_image);
});

// 11. Response
res.status(200).json({ status: "success", message: "...", pagination, results: data });
```

**نمط ثابت في كل دالة POST (مع صورة):**
```javascript
let path_image = null;

try {
    // 1. Upload image first
    path_image = await uploadAndProcessImage(BUCKET, req.file);

    // 2. DB operation
    const { data, error } = await supabase.from("table").insert({...}).select("*").single();

    if (error) throw new ApiError("...", 400);

    // 3. Invalidate cache
    await deleteByPattern("entity:*");
    await deleteCache(CACHE_KEYS.DASHBOARD);

    // 4. Transform + Response
    res.status(201).json({ status: "success", message: "...", results: data });

} catch (err) {
    // Rollback: delete uploaded image if DB failed
    await rollbackUploadedImage(BUCKET, path_image);
    return next(err);
}
```

**نمط ثابت في كل دالة PUT (مع صورة):**
```javascript
// 1. Get current record
const { data: current, error } = await supabase.from("table").select("*").eq("id", id).single();
if (!current || error) return next(new ApiError("غير موجود", 404));

// 2. Use replaceImage service (handles upload + DB + old image delete atomically)
const result = await replaceImage({
    bucket: BUCKET,
    currentImage: current.path_image,
    file: req.file,
    action: async (path_image) => {
        const { data, error } = await supabase.from("table").update({...path_image}).eq("id", id).select("*").single();
        if (!data || error) throw new ApiError("...", 400);
        return data;
    },
});

// 3. Invalidate cache
await deleteByPattern("entity:*");
await deleteCache(CACHE_KEYS.ENTITY(id));

// 4. Transform + Response
```

---

## 4. Services

أربعة خدمات مُصدَّرة كدوال named (وليست classes):

### `cache.service.js`
| الدالة | الوصف |
|--------|-------|
| `getCache(key)` | جلب من Redis، يُرجع `null` إذا لم يجد |
| `setCache(key, value, ttl)` | حفظ في Redis بـ JSON stringify، TTL افتراضي = 3600 |
| `deleteCache(key)` | حذف مفتاح واحد |
| `deleteByPattern(pattern)` | حذف مفاتيح متعددة بنمط (مثل `"doctors:*"`) |

### `storage.service.js`
| الدالة | الوصف |
|--------|-------|
| `uploadImage(bucket, fileName, buffer)` | رفع صورة إلى Supabase Storage |
| `deleteImage(bucket, fileName)` | حذف صورة |
| `getPublicImageUrl(bucket, fileName)` | الحصول على URL عام |
| `createSignedImageUrl(bucket, fileName, expiresIn)` | URL موقّعة للصور الخاصة (مثل إيصالات الدفع) |

### `imageUpload.service.js`
| الدالة | الوصف |
|--------|-------|
| `uploadAndProcessImage(bucket, file)` | معالجة + رفع، يُرجع `fileName` |
| `replaceImage({bucket, currentImage, file, action})` | استبدال صورة مع rollback في حالة الفشل |
| `rollbackUploadedImage(bucket, fileName)` | حذف صورة رُفعت ثم فشل الـ DB |

### `whatsapp.service.js`
| الدالة | الوصف |
|--------|-------|
| `sendOTP(phoneNumber, otp)` | إرسال OTP عبر WhatsApp Business API (Meta) |

---

## 5. Routes

### نمط تعريف Routes:

```javascript
// مثال: doctors.route.js
const router = express.Router();

router
    .get("/", getDoctorsInfo)
    .post("/", protect, allowedTo("admin"), uploadSingleImage("path_image"), validate(insertDoctorSchema), insertDoctor)
    .get("/:id", getOneDoctorInfo)
    .put("/:id", protect, allowedTo("admin"), uploadSingleImage("path_image"), validate(updateDoctorSchema), updateDoctor)
    .patch("/:id/status", protect, allowedTo("admin"), changeDoctorStatus)
    .patch("/:id/is_hidden", protect, allowedTo("admin"), toggleDoctorVisibility);
```

### ترتيب Middleware Chain في Route:
```
protect → allowedTo(...roles) → uploadSingleImage(fieldName) → validate(schema) → controller
```

### تسجيل Routes في `app.js`:
```javascript
app.use("/api/auth", AuthRoutes);
app.use("/api/hospital", HospitalRoutes);
app.use("/api/departments", DepartmentsRoutes);
app.use("/api/doctors", DoctorsRoutes);
app.use("/api/Ads", AdsRoutes);          // ⚠️ لاحظ: "Ads" بـ A كبيرة (inconsistency)
app.use("/api/users", UsersRoutes);
app.use("/api/appointments", AppointmentsRoutes);
app.use("/api/doctor-departments", DoctorDepartmentsRoutes);
app.use("/api/doctor-schedule", DoctorScheduleRoutes);
app.use("/api/dashboard", dashboardRouter);
```

### قائمة endpoints الموجودة:

**Auth** (`/api/auth`)
- `POST /login`, `POST /register`, `POST /verify-phone`, `POST /resend-otp`
- `POST /logout`, `GET /me`
- `POST /change-phone`, `POST /verify-change-phone`, `POST /resend-change-phone-otp`
- `POST /forget-password`, `POST /verify-reset-code`, `POST /reset-password`

**Hospital** (`/api/hospital`)
- `GET /`, `PUT /`

**Departments** (`/api/departments`)
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`

**Doctors** (`/api/doctors`)
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`
- `PATCH /:id/status`, `PATCH /:id/is_hidden`

**Ads** (`/api/Ads`)
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/toggle-status`

**Users** (`/api/users`)
- `GET /`, `GET /:id`, `PUT /:id`, `PATCH /:id/status`, `PATCH /:id/role`
- `GET /profile`, `PUT /profile`, `PATCH /change-password`

**Appointments** (`/api/appointments`)
- `GET /`, `POST /`, `GET /my-appointments`, `GET /:id`
- `PUT /:id`, `PATCH /:id/status`, `PATCH /:id/cancel`

**Doctor-Departments** (`/api/doctor-departments`)
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `GET /department/:id`, `GET /doctor/:id`

**Doctor-Schedule** (`/api/doctor-schedule`)
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `PATCH /:id/status`

**Dashboard** (`/api/dashboard`)
- `GET /statistics`, `GET /appointments-chart`

---

## 6. Middleware

### الـ Middlewares الموجودة:

| الملف | الوصف |
|-------|-------|
| `auth.middleware.js` | `protect` و `allowedTo` |
| `error.middleware.js` | `globalError` (معالجة مركزية للأخطاء) |
| `validation.middleware.js` | `validate(schema)` — يُشغّل Zod schema |
| `upload.middleware.js` | `uploadSingleImage(fieldName)` و `uploadMultipleImages(fieldName, maxCount)` |
| `rateLimit.middleware.js` | `authRateLimit` (5 طلبات/10 دقائق) و `otpRateLimit` (3 طلبات/5 دقائق) |
| `cache.middleware.js` | فارغ (0 بايت) — لم يُكتب بعد |

---

## 7. معالجة الأخطاء (Error Handling)

### نمط `ApiError`:

```javascript
// utils/ApiError.js
export default class ApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = +statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;
    }
}
```

**الاستخدام في Controllers:**
```javascript
// إرجاع الخطأ عبر next()
return next(new ApiError("رسالة الخطأ", 404));

// رمي الخطأ داخل try/catch (بدون next)
throw new ApiError("رسالة الخطأ", 400);
```

### نمط `globalError` (error.middleware.js):

```javascript
export const globalError = (err, req, res, next) => {
    const statusCode = +err.statusCode || 500;

    // معالجة أخطاء خاصة
    if (err.name === "JsonWebTokenError") err = handleJwtInvalidSignature();
    if (err.name === "TokenExpiredError")  err = handleJwtExpired();
    if (err.name === "ZodError") return res.status(400).json(handleZodError(err));

    // Development: مع stack trace
    if (process.env.MODE_DEV === "development") {
        return res.status(statusCode).json({ status, message, stack: err.stack });
    }

    // Production: بدون stack
    res.status(statusCode).json({ status, message });
};
```

### نمط معالجة Zod errors:
```javascript
const handleZodError = (err) => ({
    status: "fail",
    errors: err.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
    })),
});
```

**لاحظ**: أخطاء Zod لها شكل مختلف عن باقي الأخطاء (تُرجع `errors` بدلاً من `message`).

### معالجة `unhandledRejection` (server.js):
```javascript
process.on("unhandledRejection", (err) => {
    console.error(`unhandledRejection => ${err.name} || ${err.message}`);
    server.close(() => {
        process.exit(1);
    });
});
```

---

## 8. التحقق من البيانات (Validation)

### الأداة المستخدمة: **Zod v4**

### نمط التعريف:

كل ملف validation يُصدّر schemas كـ named exports:

```javascript
// مثال: auth.validation.js
export const loginSchema = z.object({...});
export const registerSchema = z.object({...}).refine(...).superRefine(async (data, ctx) => {...});
```

### ملاحظات على استخدام Zod:

1. **الرسائل بالعربية** — كل رسائل الخطأ مكتوبة بالعربية
2. **`superRefine` للتحقق من قاعدة البيانات** — يتحقق من تكرار الإيميل أو الهاتف داخل الـ schema نفسه (يستدعي Supabase)
3. **`z.coerce`** — مستخدم للأرقام والتواريخ القادمة من Form Data
4. **`parseAsync`** في validate middleware — لدعم الـ `superRefine` الـ async

```javascript
// validation.middleware.js
export const validate = (schema) => AsyncHandler(async (req, res, next) => {
    await schema.parseAsync(req.body);
    next();
});
```

### نمط التحقق للـ Update schemas:

يُضاف `refine` للتأكد أن على الأقل حقلاً واحداً مُرسَل:
```javascript
.refine(
    (data) => Object.keys(data).length > 0,
    { message: "يجب إرسال حقل واحد على الأقل للتعديل" }
);
```

---

## 9. المصادقة والتفويض (Authentication & Authorization)

### نمط التوثيق:

- **JWT** مُخزَّن في **httpOnly cookie** (وليس في Authorization header)
- اسم الـ cookie: `"token"`
- مدة الصلاحية: `7d` (من `.env`)

### `createSendToken` — دالة مشتركة:
```javascript
export const createSendToken = (user, statusCode, res) => {
    const token = createToken({ user_id: user.user_id, role: user.role });
    delete user.password;                    // حذف الباسوورد من الاستجابة
    res.cookie("token", token, {
        httpOnly: true, secure: false, sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(statusCode).json({ status: "success", message: "تم تسجيل الدخول بنجاح", user });
};
```

### `protect` middleware:
1. جلب الـ token من `req.cookies.token`
2. التحقق منه بـ `jwt.verify`
3. استعلام Supabase للتأكد من وجود المستخدم
4. التحقق إذا كانت كلمة المرور غُيِّرت بعد إنشاء الـ token (بمقارنة `password_changed_at` مع `iat`)
5. حفظ المستخدم في `req.user`

### `allowedTo` — middleware factory:
```javascript
export const allowedTo = (...roles) => AsyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user.role))
        return next(new ApiError("ليس لديك صلاحية للوصول", 403));
    next();
});
```

### الأدوار الموجودة:
- `"user"` — المستخدم العادي
- `"admin"` — الأدمن
- `"reception"` — الاستقبال

### OTP System:

- OTP مكوّن من 6 أرقام عشوائية
- يُخزَّن **مُشفَّراً بـ SHA-256** في قاعدة البيانات (وليس plain text)
- له صلاحية 10 دقائق افتراضياً
- يُرسَل عبر **WhatsApp Business API**
- flow لإعادة تعيين كلمة المرور: `forgetPassword → verifyPasswordResetCode → resetPassword`

---

## 10. الوصول لقاعدة البيانات (Database Access)

### قاعدة البيانات: **Supabase (PostgreSQL)**

**لا يوجد ORM** — كل الاستعلامات مكتوبة بـ **Supabase JavaScript Client** مباشرةً.

### إعداد الاتصال:
```javascript
// config/supabase.js
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,   // Service Role (صلاحية كاملة)
);
```

### أنماط الاستعلام المتكررة:

**جلب جميع السجلات مع pagination وعد:**
```javascript
const { data, error, count } = await supabase
    .from("table")
    .select("*", { count: "exact" })
    .range(from, to);
```

**جلب سجل واحد:**
```javascript
const { data, error } = await supabase
    .from("table")
    .select("*")
    .eq("id", id)
    .single();
```

**الفحص مع `maybeSingle` (لا يُرجع خطأ إذا لم يجد):**
```javascript
const { data: existingUser } = await supabase
    .from("user")
    .select("user_id")
    .eq("phone_number", phone)
    .maybeSingle();
```

**الـ Relational Query (join):**
```javascript
supabase.from("doctor").select(`
    *,
    doctor_department (
        doctor_deprtment_id,
        department (depart_id, depart_name, path_image)
    ),
    doctor_schedule (schedule_id, day_of_week, ...)
`)
```

**فحص الصلاحية عبر الاستعلام:**
```javascript
// بدلاً من جلب السجل ثم فحصه في JavaScript
supabase.from("user")
    .select("*")
    .eq("phone_otp", hashedOTP)
    .gt("phone_otp_expires", new Date().toISOString())
    .single();
```

**Parallel Queries بـ `Promise.all`:**
```javascript
const [
    { count: numberUsers },
    { count: numberDoctors },
    ...
] = await Promise.all([
    supabase.from("user").select("*", { count: "exact", head: true }),
    supabase.from("doctor").select("*", { count: "exact", head: true }),
    ...
]);
```

**استدعاء Database Function:**
```javascript
const { data } = await supabase.rpc("get_appointments_by_month", {
    selected_year: year,
});
```

### نمط التحقق من الأخطاء:

```javascript
// النمط الأكثر استخداماً
if (!data || error) return next(new ApiError("...", 404));

// للإدراج
if (error) throw new ApiError("...", 400);
```

---

## 11. معالجة الصور (Image Handling)

### خط سير الصورة (Image Pipeline):

```
HTTP Request (multipart/form-data)
    ↓ multer (memoryStorage)          ← تخزين في RAM مؤقتاً
    ↓ sharp                            ← ضغط + تحويل لـ WebP (جودة 80%) + تصغير لـ 1200px
    ↓ crypto.randomUUID() + ".webp"   ← اسم عشوائي فريد
    ↓ Supabase Storage                 ← رفع نهائي
    ↓ يُحفظ فقط fileName في DB        ← وليس URL كاملة
```

### نمط حفظ الصور في قاعدة البيانات:

**يُحفظ الـ `fileName` فقط** (مثال: `"abc123.webp"`) — وليس الـ URL الكاملة.

**الـ URL يُبنى عند كل استجابة:**
```javascript
item.path_image = getPublicImageUrl(STORAGE_BUCKETS.DOCTORS, item.path_image);
```

### أنواع URLs:
- **Public URL**: للصور العامة (أطباء، أقسام، إعلانات، مستشفى)
- **Signed URL**: للصور الخاصة (إيصالات الدفع) — مؤقتة (TTL افتراضي 3600 ثانية)

### Rollback Pattern:

عند فشل عملية قاعدة البيانات بعد رفع الصورة، يتم حذف الصورة المرفوعة:
```javascript
let path_image = null;
try {
    path_image = await uploadAndProcessImage(BUCKET, req.file);
    // DB operation...
} catch (err) {
    await rollbackUploadedImage(BUCKET, path_image);  // ← cleanup
    return next(err);
}
```

### Storage Buckets:
```javascript
export const STORAGE_BUCKETS = {
    DOCTORS: "doctor-images",
    DEPARTMENTS: "department-images",
    HOSPITALS: "Hospital-image",        // ⚠️ H كبيرة (inconsistency في التسمية)
    ADS: "ad-images",
    PAYMENT_RECEIPTS: "payment-receipts",  // Private bucket
};
```

---

## 12. Redis / Cache

### الأداة: **ioredis**

### استراتيجية الكاش (Cache Strategy): **Cache-Aside (Lazy Loading)**

```javascript
// 1. Check cache
const cached = await getCache(key);
if (cached) return transformAndSend(cached);

// 2. Fetch from DB
const data = await supabase.from(...).select(...);

// 3. Save to cache
await setCache(key, data, TTL);

// 4. Send response
```

### Cache Invalidation:

عند أي عملية تعديل/إضافة/حذف:
```javascript
await deleteByPattern("entity:*");     // للقوائم (تحتوي على filters)
await deleteCache(CACHE_KEYS.ENTITY(id));  // للسجل الفردي
await deleteCache(CACHE_KEYS.DASHBOARD);   // دائماً يُمسح عند التغيير
```

### نمط مفاتيح الكاش للقوائم:

```
doctors:page=1:limit=20:keyword=:status=all:gender=all:minExp=0:maxExp=max:minFee=0:maxFee=max:sort=full_name
departments:page=1:limit=20:keyword=:sort=name
ads:page=1:limit=20:keyword=all:status=all:expired=all:sort=-created_at
```

### مفاتيح ثابتة (من `config/cache.js`):

```javascript
export const CACHE_KEYS = {
    HOSPITAL: "hospital",
    DEPARTMENTS: "departments",
    DEPARTMENT: (id) => `department:${id}`,
    DOCTORS: "doctors",
    DOCTOR: (id) => `doctor:${id}`,
    DOCTOR_SCHEDULES: "doctor-schedules",
    DOCTOR_SCHEDULE: (id) => `doctor-schedule:${id}`,
    DOCTOR_DEPARTMENT: (id) => `doctor-department:${id}`,
    DOCTOR_DEPARTMENTS: (doctorId) => `doctor:${doctorId}:departments`,
    DEPARTMENT_DOCTORS: (departmentId) => `department:${departmentId}:doctors`,
    ADS: "ads",
    AD: (id) => `ad:${id}`,
    DASHBOARD: "dashboard-statistics",
    APPOINTMENTS_CHART: "appointments-chart",
};
```

### مدد الكاش (TTL):

| المورد | المدة |
|--------|-------|
| Hospital | 24 ساعة |
| Departments | 24 ساعة |
| Doctors | 12 ساعة |
| Doctor Departments | 24 ساعة |
| Doctor Schedules | 24 ساعة |
| Ads | 6 ساعات |
| Dashboard | 5 دقائق |

### ملاحظة على الـ Cache وصور:

الصور **لا تُحفظ كـ URLs في الكاش** — فقط الـ fileName يُحفظ، والـ URL تُبنى بعد جلب البيانات من الكاش:

```javascript
if (cachedDoctors) {
    cachedDoctors.results.forEach((doctor) => {
        doctor.path_image = getPublicImageUrl(BUCKET, doctor.path_image);  // ← يُضاف هنا
    });
    return res.json({...cachedDoctors});
}
```

---

## 13. اتفاقيات التسمية (Naming Conventions)

### الملفات:

| النوع | النمط | مثال |
|-------|-------|-------|
| Controller | `[entity].controller.js` | `doctor.controller.js` |
| Route | `[entity].route.js` | `doctors.route.js` |
| Middleware | `[feature].middleware.js` | `auth.middleware.js` |
| Validation | `[entity].validation.js` | `auth.validation.js` |
| Service | `[feature].service.js` | `cache.service.js` |
| Config | `[service].js` | `redis.js` |
| Utility | `[feature].js` | `pagination.js` |

> ⚠️ **عدم اتساق**: ملف الـ controller هو `doctor.controller.js` (مفرد) بينما الـ route هو `doctors.route.js` (جمع).

### الدوال:

| النمط | الاستخدام | مثال |
|-------|----------|-------|
| `get[Entity]Info` | جلب جميع السجلات | `getDoctorsInfo` |
| `getOne[Entity]Info` | جلب سجل واحد | `getOneDoctorInfo` |
| `insert[Entity]` | إضافة سجل | `insertDoctor` |
| `update[Entity]` | تعديل سجل | `updateDoctor` |
| `delete[Entity]` | حذف سجل | `deleteDepartment` |
| `change[Entity]Status` | تغيير حالة | `changeDoctorStatus` |
| `toggle[Entity][Property]` | toggle | `toggleDoctorVisibility` |
| `create[Entity]` | إنشاء (للمستخدمين) | `createAppointment` |

### المتغيرات:

- **camelCase** للمتغيرات المحلية: `currentDoctor`, `hashedPassword`
- **snake_case** لحقول قاعدة البيانات والـ body: `full_name`, `phone_number`, `path_image`
- **SCREAMING_SNAKE_CASE** للثوابت: `CACHE_KEYS`, `STORAGE_BUCKETS`, `CACHE_TTL`
- **PascalCase** للـ imports من Routes: `AuthRoutes`, `DoctorsRoutes`

### Schemas الـ Zod:

```
[action][Entity]Schema
// أمثلة:
loginSchema
registerSchema
insertDoctorSchema
updateDoctorSchema
insertAppointmentSchema
changeAppointmentsStatusSchema
```

---

## 14. هيكل استجابة الـ API (API Response Structure)

### الاستجابة الناجحة:

```javascript
// للقوائم
{
    status: "success",
    message: "تم جلب ... بنجاح",     // أو "تم جلب البيانات من Redis"
    pagination: {
        page: 1,
        limit: 20,
        totalResults: 100,
        totalPages: 5,
        nextPage: 2,          // أو null
        prevPage: null,        // أو رقم
    },
    results: [...]
}

// للسجل الواحد أو العمليات (إضافة، تعديل، حذف)
{
    status: "success",
    message: "تم ... بنجاح",
    results: {...}           // أو غير موجود في بعض حالات الحذف
}

// للعمليات بدون بيانات (logout، change-password)
{
    status: "success",
    message: "تم ... بنجاح"
}
```

### الاستجابة الخاطئة:

```javascript
// خطأ عادي
{
    status: "fail",          // 4xx errors
    message: "رسالة الخطأ"
}
{
    status: "error",         // 5xx errors
    message: "رسالة الخطأ"
}

// خطأ Zod (validation) - شكل مختلف!
{
    status: "fail",
    errors: [
        { field: "phone_number", message: "رقم الهاتف غير صالح" },
        { field: "password", message: "كلمة المرور مطلوبة" }
    ]
}

// في Development فقط
{
    status: "...",
    message: "...",
    stack: "Error: ...\n    at ..."    // stack trace
}
```

---

## 15. معالجة الـ Async (Async Handling)

### الأداة: **`express-async-handler`**

كل controller function ملفوف بـ `AsyncHandler`:
```javascript
export const myFunction = AsyncHandler(async (req, res, next) => {
    // كل async/await errors تُرسَل تلقائياً لـ next()
});
```

**لماذا**: حتى لا يحتاج كل دالة لـ try/catch ويرسل الأخطاء تلقائياً لـ `globalError`.

### الاستثناء (try/catch صريح):

يُستخدم try/catch فقط في حالة واحدة: **عندما يكون هناك رفع صورة قبل عملية قاعدة البيانات** لتفعيل الـ rollback:
```javascript
export const insertDoctor = AsyncHandler(async (req, res, next) => {
    let path_image = null;
    try {
        path_image = await uploadAndProcessImage(...);
        // DB operation
        res.status(201).json({...});
    } catch (err) {
        await rollbackUploadedImage(BUCKET, path_image);
        return next(err);
    }
});
```

---

## 16. إعداد المشروع (Project Configuration)

### نقطة الدخول: `src/server.js`

```javascript
import "dotenv/config";         // تحميل .env أولاً
import app from "./app.js";
import "./config/redis.js";     // تشغيل اتصال Redis كـ side effect

app.listen(PORT, () => console.log(...));
process.on("unhandledRejection", ...);  // معالجة الأخطاء غير المتوقعة
```

### إعداد Express: `src/app.js`

```
helmet()          → CORS → express.json() → express.urlencoded() → cookieParser() → compression()
→ Routes → 404 handler → globalError
```

### الـ Middlewares العامة:

| الـ Middleware | الغرض |
|----------------|-------|
| `helmet` | headers أمنية |
| `cors` | مفتوح لـ `http://localhost:5173` فقط |
| `express.json()` | قراءة JSON body |
| `express.urlencoded({extended: true})` | قراءة Form data |
| `cookieParser()` | قراءة الـ cookies |
| `compression()` | ضغط الاستجابات |

### package.json:

```json
{
    "type": "module",           // ← ESM (import/export) وليس CommonJS
    "scripts": {
        "dev": "nodemon src/server.js",
        "start": "node src/server.js"
    }
}
```

### Docker:

```yaml
services:
    backend:  # Node.js app
    redis:    # redis:8-alpine
```

---

## 17. متغيرات البيئة (.env)

```
MODE_DEV=development           # يتحكم في عرض stack trace في الأخطاء

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

REDIS_HOST=redis               # اسم الـ service في docker-compose
REDIS_PORT=6379

PORT=5175

SECRET_KEY_JWT=...
JWT_EXPIRES_IN=7d

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=...
EMAIL_PASSWORD=...

META_ACCESS_TOKEN=...          # WhatsApp Business API
META_PHONE_NUMBER_ID=...
META_BUSINESS_ACCOUNT_ID=...
META_API_VERSION=v23.0

PLATFORM_FEE=500               # رسوم المنصة لكل حجز
```

---

## 18. تنظيم الكود (Code Organization)

### الـ Comments المستخدمة:

**كل دالة public في الـ controllers والـ middlewares تبدأ بـ:**
```javascript
// @Desc وصف الدالة
// @Route GET/POST/... : /api/path
// @Access Public | Private (Admin) | Private (Admin, Reception)
```

**للدوال الخاصة الداخلية:**
```javascript
// @Desc ...
// @Param ...
```

**للأقسام الكبيرة:**
```javascript
// ===== section title =====
// ============ section title ===========
/* ========================= section ========================= */
```

### Imports: ترتيب ثابت في كل controller:

```javascript
// 1. Database
import { supabase } from "../config/supabase.js";

// 2. Express utilities
import AsyncHandler from "express-async-handler";

// 3. Custom errors/utils
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";

// 4. Storage services
import { getPublicImageUrl } from "../services/storage.service.js";
import { STORAGE_BUCKETS } from "../config/storage.js";
import { replaceImage, uploadAndProcessImage } from "../services/imageUpload.service.js";

// 5. Cache services
import { getCache, setCache, deleteCache, deleteByPattern } from "../services/cache.service.js";
import { CACHE_KEYS, CACHE_TTL } from "../config/cache.js";
```

---

## 19. طريقة كتابة الدوال

### الدوال المشتركة (Shared Constants):

تُعرَّف في أعلى الملف خارج الدوال:
```javascript
// appointments.controller.js & dashboard.controller.js
const platform_fee_ = Number(process.env.PLATFORM_FEE);

// appointments.controller.js
const selectStatment = `
    *,
    doctor_schedule (schedule_id, doctor_id, doctor (...)),
    user (user_id, full_name, ...)
`;

// users.controller.js
const selectedColumns = `user_id,full_name,email,...`;

// doctorDepartments.controller.js
const selectStatment = `doctor_deprtment_id,doctor (*),department (*)`;
```

### نمط الـ Sorting المتكرر:

```javascript
// يتكرر في: appointments, users, doctors, ads
if (sort.startsWith("-")) {
    query = query.order(sort.substring(1), { ascending: false });
} else {
    query = query.order(sort, { ascending: true });
}
```

نسخة مضغوطة (في doctors, ads):
```javascript
query = query.order(sort.startsWith("-") ? sort.substring(1) : sort, {
    ascending: !sort.startsWith("-"),
});
```

### نمط Pagination:

```javascript
// utils/pagination.js
export const paginate = (req) => {
    const page = req.query.page * 1 || 1;    // * 1 بدلاً من parseInt أو Number()
    const limit = req.query.limit * 1 || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return { page, limit, from, to };
};
```

---

## 20. فصل المسؤوليات (Separation of Concerns)

### مخطط المسؤوليات:

```
├── server.js         → بدء السيرفر، معالجة الأخطاء غير المتوقعة
├── app.js            → إعداد Express، تسجيل Middlewares والـ Routes
├── config/
│   ├── supabase.js   → إنشاء instance واحد مشترك لـ Supabase
│   ├── redis.js      → إنشاء instance واحد مشترك لـ Redis
│   ├── cache.js      → مركزة مفاتيح وصلاحيات الكاش (لا منطق)
│   └── storage.js    → مركزة أسماء الـ Buckets (لا منطق)
├── middlewares/
│   ├── auth.middleware.js        → التحقق من الهوية والصلاحيات
│   ├── validation.middleware.js  → تشغيل Zod schemas
│   ├── upload.middleware.js      → استقبال الملفات (multer)
│   ├── rateLimit.middleware.js   → تحديد معدل الطلبات
│   └── error.middleware.js       → معالجة الأخطاء المركزية
├── utils/
│   ├── ApiError.js       → تعريف custom error class
│   ├── pagination.js     → حساب pagination
│   ├── otp.js            → توليد OTP وتشفيره
│   ├── imageUploader.js  → معالجة الصورة (sharp) فقط
│   ├── phone.js          → تطبيع أرقام الهاتف اليمنية
│   ├── sendEmail.js      → إرسال البريد الإلكتروني
│   └── emailTemplate.js  → قوالب HTML للبريد
├── services/
│   ├── cache.service.js       → CRUD على Redis
│   ├── storage.service.js     → CRUD على Supabase Storage
│   ├── imageUpload.service.js → تجميع معالجة + رفع + rollback
│   └── whatsapp.service.js    → إرسال WhatsApp عبر Meta API
├── validations/
│   └── [entity].validation.js → schemas Zod للتحقق من المدخلات
├── routes/
│   └── [entity].route.js      → تعريف endpoints وسلسلة الـ middlewares
└── controller/
    └── [entity].controller.js → منطق التطبيق + استعلامات DB + cache management
```

---

## 21. الأنماط المتكررة — ملخص

### 1. نمط Cache-Aside لكل GET:
```
Check Redis → [Hit: transform + return] → [Miss: DB query → Save cache → transform + return]
```

### 2. نمط Image-DB Rollback لكل POST/PUT مع صورة:
```
Upload image → DB operation → [Error: delete image → throw] → [Success: invalidate cache → respond]
```

### 3. نمط `replaceImage` لكل PUT مع صورة:
```
Get current → replaceImage({bucket, currentImage, file, action: DB update}) → invalidate cache
```

### 4. نمط Middleware Chain في Routes:
```
protect → allowedTo → upload → validate → controller
```

### 5. نمط استجابة موحدة:
```javascript
{ status: "success" | "fail" | "error", message: "...", results: data }
```

### 6. نمط التحقق بـ `!data || error`:
```javascript
if (!data || error) return next(new ApiError("...", statusCode));
```

### 7. نمط Invalidation بعد أي تعديل:
```javascript
await deleteByPattern("entity:*");
await deleteCache(CACHE_KEYS.ENTITY(id));
await deleteCache(CACHE_KEYS.DASHBOARD);   // دائماً
```

### 8. نمط OTP:
```
Generate → Hash (SHA-256) → Save hashed → Send plain → Compare hashed on verify
```

---

## 22. تقنيات المشروع — ملخص

| الفئة | التقنية |
|-------|---------|
| Runtime | Node.js (ESM modules) |
| Framework | Express v5 |
| Database | Supabase (PostgreSQL) |
| ORM | لا يوجد (Supabase JS Client) |
| Cache | Redis (ioredis) |
| File Storage | Supabase Storage |
| Auth | JWT في httpOnly Cookie |
| Validation | Zod v4 |
| Image Processing | sharp (WebP, 1200px, 80% quality) |
| File Upload | multer (memoryStorage) |
| Password Hashing | bcrypt (rounds: 12) |
| OTP | crypto (SHA-256) + random 6 digits |
| Notifications | WhatsApp Business (Meta API) |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Docker + docker-compose |

---

*تم إنشاء هذا التقرير بتاريخ: 2026-08-09*  
*الكود المُحلَّل: `d:\programming\Hospritals\project files\BackEnd`*
