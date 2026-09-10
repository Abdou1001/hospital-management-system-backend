import express from "express";

import {optionalProtect} from "../middlewares/auth.middleware.js";

import {
    getNotifications,
    getOneNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteAllNotifications,
} from "../controller/notifications.controller.js";

const router = express.Router();

router
    .get("/", optionalProtect, getNotifications)

    .patch("/read-all", optionalProtect, markAllNotificationsAsRead)

    .delete("/", optionalProtect, deleteAllNotifications)

    .get("/:id", optionalProtect, getOneNotification)

    .patch("/:id/read", optionalProtect, markNotificationAsRead)

    .delete("/:id", optionalProtect, deleteNotification);

export default router;
