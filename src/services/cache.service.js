import {redis} from "../config/redis.js";

const REDIS_TIMEOUT_MS = 2000;

const withTimeout = (promise, ms = REDIS_TIMEOUT_MS) =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms),
        ),
    ]);

const isRedisReady = () => redis && redis.status === "ready";

/**
 * الحصول على البيانات من Redis
 * عند فشل Redis يُرجع null ويستمر Controller في جلب البيانات من Database
 */
export const getCache = async (key) => {
    if (!isRedisReady()) {
        console.error(
            `[Cache] Redis is not ready (status: ${redis?.status}), bypassing getCache for key "${key}"`,
        );
        return null;
    }

    try {
        const data = await withTimeout(redis.get(key));

        if (!data) return null;

        return JSON.parse(data);
    } catch (err) {
        console.error(`[Cache] getCache failed for key "${key}":`, err.message);
        return null;
    }
};

/**
 * حفظ البيانات في Redis
 * عند فشل Redis يُسجَّل الخطأ دون كسر الـ Request
 */
export const setCache = async (key, value, ttl = 3600) => {
    if (!isRedisReady()) {
        console.error(
            `[Cache] Redis is not ready (status: ${redis?.status}), skipping setCache for key "${key}"`,
        );
        return;
    }

    try {
        await withTimeout(redis.set(key, JSON.stringify(value), "EX", ttl));
    } catch (err) {
        console.error(`[Cache] setCache failed for key "${key}":`, err.message);
    }
};

/**
 * حذف كاش معين
 * عند فشل Redis يُسجَّل الخطأ دون كسر الـ Request
 */
export const deleteCache = async (key) => {
    if (!isRedisReady()) {
        console.error(
            `[Cache] Redis is not ready (status: ${redis?.status}), skipping deleteCache for key "${key}"`,
        );
        return;
    }

    try {
        await withTimeout(redis.del(key));
    } catch (err) {
        console.error(
            `[Cache] deleteCache failed for key "${key}":`,
            err.message,
        );
    }
};

/**
 * حذف كاش عبر Pattern
 * عند فشل Redis يُسجَّل الخطأ دون كسر الـ Request
 */
export const deleteByPattern = async (pattern) => {
    if (!isRedisReady()) {
        console.error(
            `[Cache] Redis is not ready (status: ${redis?.status}), skipping deleteByPattern for pattern "${pattern}"`,
        );
        return;
    }

    try {
        const keys = await withTimeout(redis.keys(pattern));

        if (keys.length > 0) {
            await withTimeout(redis.del(...keys));
        }
    } catch (err) {
        console.error(
            `[Cache] deleteByPattern failed for pattern "${pattern}":`,
            err.message,
        );
    }
};