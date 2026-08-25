# AGENTS.md — Instructions for AI Coding Assistants

This repository follows strict, documented backend patterns and architectural decisions. When modifying or extending this codebase, follow these mandatory instructions.

---

## 1. Documentation Index

Before implementing new features or refactoring, refer to the documentation files in `docs/`:
- `docs/architecture.md`: Full architecture, directory responsibilities, and layer boundaries.
- `docs/coding-conventions.md`: Naming conventions for files, variables, functions, comments, and imports.
- `docs/api-conventions.md`: API response structures, HTTP status codes, pagination, and error responses.
- `docs/reference-patterns.md`: Concrete implementation code snippets (Cache-Aside, Image Rollback, replaceImage, etc.).
- `docs/analysis/backend-analysis.md`: Complete reverse-engineered analysis of the codebase.

---

## 2. Core Rules & Strict Restrictions

1. **Do NOT add new npm libraries** or external dependencies without explicit user request.
2. **Do NOT alter the core architecture** (e.g., do not introduce a repository layer, ORM models directory, or class-based controllers).
3. **Audit existing implementations first**: Search for pre-existing examples in `src/controller/` and `src/services/` before creating new helper patterns.
4. **Follow exact established style**: Do NOT introduce unsolicited "best practices", code formatting shifts, or architectural alterations.

---

## 3. Strict Layer Categorization

### A. MUST FOLLOW (Mandatory Across All Endpoints)

- **Architecture**: Layered (`Route → Middleware Chain → Controller → BaaS/Services`). Controllers hold all application business logic and database queries directly.
- **Directory Structure**:
  - `src/controller/`: `[entity].controller.js`
  - `src/routes/`: `[entity].route.js`
  - `src/validations/`: `[entity].validation.js`
  - `src/middlewares/`: `[feature].middleware.js`
  - `src/services/`: `[feature].service.js`
  - `src/config/`: `[service].js`
  - `src/utils/`: `[feature].js`
- **Naming Conventions**:
  - Files: `[entity].controller.js`, `[entity].route.js`, `[entity].validation.js`.
  - Variables: camelCase for JavaScript locals (`currentDoctor`), snake_case for DB fields and payload keys (`full_name`), SCREAMING_SNAKE_CASE for constants (`CACHE_KEYS`).
  - Controller Functions: `get[Entity]Info`, `getOne[Entity]Info`, `insert[Entity]`, `create[Entity]`, `update[Entity]`, `delete[Entity]`, `change[Entity]Status`, `toggle[Entity][Property]`.
  - Validation Schemas: `[action][Entity]Schema`.
- **Controllers**: Exported as named functions wrapped with `AsyncHandler`. Top-level constants (e.g. `selectStatment`) defined outside functions.
- **Routes**: Chain order MUST be: `protect → allowedTo(...roles) → upload → validate(schema) → controller`.
- **Validation**: Zod schemas executed asynchronously via `validate(schema)` middleware (`await schema.parseAsync(req.body)`).
- **Error Handling**: Use `return next(new ApiError(message, statusCode))` for operational errors. Global error handling managed by `globalError` middleware in `app.js`. Process-level rejections handled in `server.js`.
- **Async Handling**: Wrap all controller functions in `express-async-handler` (`AsyncHandler`). Explicit `try/catch` is restricted to operations requiring resource cleanup/rollback (e.g., image upload before database insertion).
- **API Response Structure**:
  - List: `{ status: "success", message, pagination, results: [...] }`
  - Item/CRUD: `{ status: "success", message, results: {...} }`
  - No-data Action: `{ status: "success", message }`
  - Error: `{ status: "fail" | "error", message }` (or `{ status: "fail", errors: [...] }` for Zod).

### B. REFERENCE PATTERNS (Use When Applicable)

Refer to `docs/reference-patterns.md` for exact implementation code snippets when building matching features:
- **Cache-Aside Pattern**: Check Redis cache using `getCache(key)` -> hit: return transformed URLs -> miss: query DB, `setCache(...)`, return.
- **Cache Invalidation**: `deleteByPattern("entity:*")`, `deleteCache(CACHE_KEYS.ENTITY(id))`, and `deleteCache(CACHE_KEYS.DASHBOARD)` on any mutation.
- **Image Rollback**: Upload image first in `try` block -> DB error caught in `catch` -> call `rollbackUploadedImage(...)`.
- **`replaceImage` Service**: Use `replaceImage({ bucket, currentImage, file, action })` for updates with new file uploads.
- **Pagination**: Use `paginate(req)` for `from`/`to` offset range calculation and `paginationResult(page, limit, count)` for metadata.
- **`allowedTo`**: Use `allowedTo("admin", "reception")` middleware factory for role checks.
- **`Promise.all`**: Use for concurrent independent count/data queries.
- **`maybeSingle`**: Use Supabase `.maybeSingle()` when checking unique constraint duplicates without throwing errors.
- **OTP Handling**: Generate 6-digit OTP, store SHA-256 hash in DB, send plain OTP via WhatsApp service.
- **Services**: Implement services as exported named async functions (not class instances).

### C. PROJECT-SPECIFIC (Contextual to Hospital System)

Do NOT enforce these context-specific choices on unrelated projects:
- BaaS DB Client: Supabase JS Client without ORM models.
- Auth Storage: JWT stored in HTTP-only `token` cookie.
- WhatsApp Integration: OTP delivery via Meta Graph API.
- Phone Normalization: Yemeni format (`967...`).
- Platform Fee: `PLATFORM_FEE` calculations on appointments.
- Business domain schemas (Doctors, Schedules, Departments, Appointments).
