import ApiError from "../utils/ApiError.js";


// @Desc Handle invalid token
const handleJwtInvalidSignature = () =>
    new ApiError("التوكن غير صالح، يرجى تسجيل الدخول مرة أخرى.", 401);


// @Desc Handle expired token
const handleJwtExpired = () =>
    new ApiError("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا.", 401);


// @Desc Handle zod validation errors
const handleZodError = (err) => ({
    status: "fail",

    errors: err.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
    })),
});


// @Desc Global error middleware
export const globalError = (err, req, res, next) => {

    const statusCode = err.statusCode || 500;

    if (err.name === "JsonWebTokenError")
        err = handleJwtInvalidSignature();

    if (err.name === "TokenExpiredError")
        err = handleJwtExpired();

    if (err.name === "ZodError")
        return res.status(400).json(handleZodError(err));

    if (process.env.MODE_DEV === "development") {

        return res.status(statusCode).json({
            status: err.status || "error",
            message: err.message || "حدث خطأ في السيرفر",
            stack: err.stack,
        });

    }

    res.status(statusCode).json({
        status: err.status || "error",
        message: err.message || "حدث خطأ في السيرفر",
    });

};