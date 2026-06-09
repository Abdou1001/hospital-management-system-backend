import rateLimit from "express-rate-limit";


// @Desc Limit auth requests
export const authRateLimit = rateLimit({

    // 15 minutes
    windowMs: 15 * 60 * 1000,

    // 5 requests only
    max: 5,

    // Error message
    message: {
        status: "fail",
        message: "محاولات تسجيل دخول كثيرة جدًا، حاول بعد 15 دقيقة",
    },

    standardHeaders: true,
    legacyHeaders: false,

});