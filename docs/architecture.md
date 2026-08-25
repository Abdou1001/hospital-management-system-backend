# Architecture & Layer Responsibilities

## Overview

The project follows a **Layered Architecture** pattern tailored for Express and BaaS (Supabase) + Cache (Redis):

```
Request → Route → Middleware Chain → Controller → Service / Utils → External BaaS (Supabase / Redis)
```

---

## Key Architectural Decisions

1. **Integrated Business Logic in Controllers**:
   - There is no separate business service layer between Controllers and Database.
   - Database queries (via Supabase JS Client), caching logic, filtering/sorting, and application logic reside directly inside the Controller functions.

2. **External Integration Services**:
   - The `services/` directory is reserved for wrapping external services and infrastructure concerns (Redis Cache operations, Supabase Storage operations, Image processing orchestration, WhatsApp Meta API).

3. **No Local ORM Models**:
   - Database schemas and tables are managed externally via Supabase (PostgreSQL). No local ORM models directory (`models/`) exists.

4. **Stateless Auth via JWT & Cookies**:
   - Authentication tokens are generated using JWT and stored in HTTP-only cookies (`token`).

---

## Directory & File Responsibilities

### 1. Entry Point (`src/server.js`)
- Loads environment variables (`dotenv/config`).
- Imports and starts the Express application instance (`app.js`).
- Initializes side-effect connections (e.g., Redis client `config/redis.js`).
- Handles global process-level rejections (`process.on('unhandledRejection')`).

### 2. Application Setup (`src/app.js`)
- Instantiates the Express application.
- Applies global security, parsing, and compression middlewares:
  - `helmet()`: Security headers.
  - `cors(...)`: Cross-Origin Resource Sharing configuration.
  - `express.json()` & `express.urlencoded(...)`: Body parsing.
  - `cookieParser()`: Cookie parsing.
  - `compression()`: JSON payload compression.
- Mounts feature route modules under `/api/...`.
- Handles unmatched routes (404 handler sending `ApiError`).
- Mounts the global error middleware (`globalError`) as the final handler.

### 3. Configuration (`src/config/`)
Centralizes client instances and system-wide constants (no business logic):
- `supabase.js`: Initializes and exports the Supabase client using Service Role key.
- `redis.js`: Initializes and exports the ioredis client.
- `cache.js`: Centralizes cache key generator functions (`CACHE_KEYS`) and Time-To-Live durations (`CACHE_TTL`).
- `storage.js`: Defines storage bucket identifiers (`STORAGE_BUCKETS`).

### 4. Routes (`src/routes/`)
Defines API endpoints and binds middleware chains to controller actions:
- Configures HTTP verbs (`.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`).
- Chains middlewares in a strict order (`protect → allowedTo → upload → validate → controller`).

### 5. Controllers (`src/controller/`)
Contains all request-handling logic:
- Extracts parameters from `req.params`, `req.query`, and `req.body`.
- Invokes pagination and sorting logic.
- Implements Cache-Aside reads and Cache Invalidations.
- Executes database queries using `supabase.from(...)`.
- Handles error throwing via `ApiError` / `next(new ApiError(...))`.
- Formats final response payloads.

### 6. Middlewares (`src/middlewares/`)
Reusable HTTP request interceptors:
- `auth.middleware.js`: Route protection (`protect`) and role-based access control (`allowedTo`).
- `validation.middleware.js`: Executes Zod schema parsing asynchronously (`validate(schema)`).
- `upload.middleware.js`: Configures multer memory storage and file type filtering for single/multiple image uploads.
- `rateLimit.middleware.js`: Protects sensitive routes (auth, OTP) from brute-force attempts.
- `error.middleware.js`: Global error formatting and response middleware (`globalError`).

### 7. Validations (`src/validations/`)
Declares request payload validation rules:
- Built using Zod v4 schemas.
- Exports named schema constants (e.g., `loginSchema`, `insertDoctorSchema`).
- Handles async database uniqueness checks via `superRefine`.

### 8. Services (`src/services/`)
Wraps infrastructure operations into exported named functions:
- `cache.service.js`: Low-level Redis `getCache`, `setCache`, `deleteCache`, `deleteByPattern`.
- `storage.service.js`: Direct Supabase Storage uploads, deletes, public URL building, and signed URL generation.
- `imageUpload.service.js`: High-level image pipeline helpers (`uploadAndProcessImage`, `replaceImage`, `rollbackUploadedImage`).
- `whatsapp.service.js`: Meta Graph API integration for sending WhatsApp OTP messages.

### 9. Utilities (`src/utils/`)
Pure functions and helper abstractions:
- `ApiError.js`: Custom Error class attaching HTTP status codes and operational flags.
- `pagination.js`: Query range calculations (`paginate`) and response metadata builders (`paginationResult`).
- `otp.js`: 6-digit OTP generation, SHA-256 hashing, and expiration timestamp calculation.
- `imageUploader.js`: Sharp configuration for WebP conversion, resizing, and compression.
- `phone.js`: Yemeni phone format normalization (`967...`).
- `sendEmail.js` & `emailTemplate.js`: Nodemailer wrapper and HTML email templates.
