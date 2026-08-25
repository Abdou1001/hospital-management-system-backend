# Coding & Naming Conventions

## 1. File Naming Conventions

All files must follow standard suffix conventions based on their layer:

| Layer | Naming Pattern | Example |
|-------|----------------|---------|
| Controller | `[entity].controller.js` | `doctor.controller.js`, `auth.controller.js` |
| Route | `[entity].route.js` | `doctors.route.js`, `auth.route.js` |
| Middleware | `[feature].middleware.js` | `auth.middleware.js`, `upload.middleware.js` |
| Validation | `[entity].validation.js` | `doctors.validation.js`, `auth.validation.js` |
| Service | `[feature].service.js` | `cache.service.js`, `storage.service.js` |
| Config | `[service].js` | `redis.js`, `supabase.js` |
| Utility | `[feature].js` | `pagination.js`, `otp.js` |

---

## 2. Variable Naming Conventions

- **camelCase**: Used for JavaScript local variables, function names, object instances, and parameters.
  - Examples: `currentDoctor`, `hashedPassword`, `cachedDoctors`, `firstDayOfMonth`.
- **snake_case**: Used for database column names, API request body keys, and database query fields.
  - Examples: `full_name`, `phone_number`, `date_of_birth`, `path_image`, `user_id`.
- **SCREAMING_SNAKE_CASE**: Used for constants and exported configuration objects.
  - Examples: `CACHE_KEYS`, `STORAGE_BUCKETS`, `CACHE_TTL`, `ACCESS_TOKEN`.
- **PascalCase**: Used when importing Route modules in `app.js` or class names.
  - Examples: `AuthRoutes`, `DoctorsRoutes`, `ApiError`.

---

## 3. Function Naming Conventions

### Controller Functions
Controller handler functions are exported named functions and must follow these action prefix patterns:

| Pattern | Action | Example |
|---------|--------|---------|
| `get[Entity]Info` | Fetch list of records with filters/pagination | `getDoctorsInfo`, `getAppointmentsInfo` |
| `getOne[Entity]Info` | Fetch a single record by ID | `getOneDoctorInfo`, `getOneDepartmentInfo` |
| `insert[Entity]` | Admin action to insert a record | `insertDoctor`, `insertDepartment`, `insertAd` |
| `create[Entity]` | Public/User action to create a resource | `createAppointment` |
| `update[Entity]` | Update record details | `updateDoctor`, `updatetDepartment` |
| `delete[Entity]` | Delete a record | `deleteDepartment`, `deleteAd` |
| `change[Entity]Status` | Update status field of a entity | `changeDoctorStatus`, `changeUserStatus` |
| `toggle[Entity][Property]` | Toggle boolean or state property | `toggleDoctorVisibility`, `toggleAdStatus` |

### Validation Schemas (Zod)
Validation schemas follow the `[action][Entity]Schema` convention:
- Examples: `loginSchema`, `registerSchema`, `insertDoctorSchema`, `updateDoctorSchema`, `changeAppointmentsStatusSchema`.

---

## 4. Import Statement Ordering

Inside controllers and routes, imports must be grouped and ordered consistently:

```javascript
// 1. Database connection client
import { supabase } from "../config/supabase.js";

// 2. Express async wrapper
import AsyncHandler from "express-async-handler";

// 3. Custom error classes & utility helpers
import ApiError from "../utils/ApiError.js";
import { paginate, paginationResult } from "../utils/pagination.js";

// 4. Storage services & constants
import { getPublicImageUrl } from "../services/storage.service.js";
import { STORAGE_BUCKETS } from "../config/storage.js";
import { replaceImage, uploadAndProcessImage } from "../services/imageUpload.service.js";

// 5. Cache services & constants
import { getCache, setCache, deleteCache, deleteByPattern } from "../services/cache.service.js";
import { CACHE_KEYS, CACHE_TTL } from "../config/cache.js";
```

---

## 5. Commenting Standards

### Controller & Middleware Header Annotations
Every public controller function and middleware must include a JSDoc-style comment header specifying description, HTTP route, and access level:

```javascript
// @Desc Get all Doctors with pagination, search, filters and sorting
// @Route GET : /api/doctors/
// @Access Public
export const getDoctorsInfo = AsyncHandler(async (req, res, next) => { ... });

// @Desc Protect routes and check if user logged in
// @Route Middleware
// @Access Private
export const protect = AsyncHandler(async (req, res, next) => { ... });
```

### Internal Helper Annotations
```javascript
// @Desc Makes Token for login users
// @Param Takes user_id and role to make token
const createToken = (payload) => { ... };
```

### Section Dividers
Use block dividers to organize large files into logical sections:
```javascript
// ===== auth operations ====

// ============ Change Phone Number to New One =============

/* =========================
   Login Validation
========================= */
```

---

## 6. Code Organization Practices

1. **ES Module System**: Always use ESM (`import` / `export`). CommonJS (`require` / `module.exports`) is not used.
2. **Top-Level Constants inside Modules**:
   - Define reusable query strings or selection columns at the top of the controller file outside function scopes:
     ```javascript
     const platform_fee_ = Number(process.env.PLATFORM_FEE);
     const selectedColumns = `user_id,full_name,email,role,date_of_birth,gender,phone_number,created_at,is_active`;
     const selectStatment = `doctor_deprtment_id,doctor (*),department (*)`;
     ```
3. **Services as Named Function Exports**:
   - Services export individual named functions (e.g., `export const getCache = ...`), not class instances.
