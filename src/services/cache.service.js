import {redis} from "../config/redis.js";

/**
 * الحصول على البيانات من Redis
 */
export const getCache = async (key) => {
    const data = await redis.get(key);

    if (!data) return null;

    return JSON.parse(data);
};
/**
 * حفظ البيانات في Redis
 */
export const setCache = async (key, value, ttl = 3600) => {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
};

/**
 * حذف كاش معين
 */
export const deleteCache = async (key) => {
    await redis.del(key);
};

export const deleteByPattern = async (pattern) => {
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
        await redis.del(...keys);
    }
};