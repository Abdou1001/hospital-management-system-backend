# API & Response Conventions

## 1. API Response Structure

All API responses follow a uniform JSON payload structure.

### 1.1 List (Paginated) Response Structure
```json
{
    "status": "success",
    "message": "تم جلب البيانات بنجاح",
    "pagination": {
        "page": 1,
        "limit": 20,
        "totalResults": 100,
        "totalPages": 5,
        "nextPage": 2,
        "prevPage": null
    },
    "results": [
        { "id": 1, "name": "..." }
    ]
}
```

### 1.2 Single Item / CRUD Action Response Structure
```json
{
    "status": "success",
    "message": "تم إضافة البيانات بنجاح",
    "results": {
        "id": 1,
        "name": "..."
    }
}
```

### 1.3 Action Without Return Data Response Structure
```json
{
    "status": "success",
    "message": "تم تسجيل الخروج بنجاح"
}
```

---

## 2. Pagination Conventions

Pagination logic is standardized using `utils/pagination.js`.

### Query Parameters
- `page`: Optional. Defaults to `1`. (Coerced via `req.query.page * 1 || 1`).
- `limit`: Optional. Defaults to `20`. (Coerced via `req.query.limit * 1 || 20`).

### Range Offset Calculation for Supabase
```javascript
const from = (page - 1) * limit;
const to = from + limit - 1;
// Executed as: .range(from, to)
```

### Helper Functions Usage
```javascript
import { paginate, paginationResult } from "../utils/pagination.js";

// Extract pagination parameters
const { page, limit, from, to } = paginate(req);

// Execute query with range and exact count
const { data, error, count } = await query.range(from, to);

// Build pagination response object
const pagination = paginationResult(page, limit, count);
```

---

## 3. Error Handling & Response Structures

Error responses distinguish between operational application errors and Zod validation errors.

### 3.1 Standard Operational Error Response Structure
For operational errors raised via `ApiError`:
- **4xx Client Errors**: Response status set to `"fail"`.
- **5xx Server Errors**: Response status set to `"error"`.

```json
{
    "status": "fail",
    "message": "المستخدم غير موجود"
}
```

### 3.2 Development Mode Stack Trace
When `process.env.MODE_DEV === "development"`, the stack trace is attached to the error response:
```json
{
    "status": "error",
    "message": "حدث خطأ في السيرفر",
    "stack": "Error: ...\n    at ..."
}
```

### 3.3 Zod Validation Error Response Structure
When Zod schema validation fails, the `globalError` middleware intercepts `ZodError` and returns an array of field errors:

```json
{
    "status": "fail",
    "errors": [
        {
            "field": "phone_number",
            "message": "رقم الهاتف اليمني غير صالح"
        },
        {
            "field": "password",
            "message": "كلمة المرور يجب أن تكون على الأقل 6 أحرف"
        }
    ]
}
```

---

## 4. HTTP Status Code Conventions

| Status Code | Usage Scenario | Example |
|-------------|----------------|---------|
| `200 OK` | Successful GET, PUT, PATCH, DELETE operations, or authentication success | Fetching list, updating record, login |
| `201 Created` | Successful POST creation | Registering user, inserting doctor, creating appointment |
| `400 Bad Request` | Zod validation error, invalid business logic state, duplicate request | Invalid OTP, schedule limit reached |
| `401 Unauthorized` | Missing authentication token, expired token, invalid credentials | Missing cookie, incorrect password |
| `403 Forbidden` | Authenticated user lacks authorized role | User accessing admin route |
| `404 Not Found` | Requested resource or endpoint does not exist | Doctor ID not found |
| `409 Conflict` | Unique constraint violation in database | Phone number already registered |
| `500 Internal Server Error` | Database query failure, external API error | Supabase connection issue |
