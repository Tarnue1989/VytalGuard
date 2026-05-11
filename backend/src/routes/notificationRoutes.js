// 📁 backend/src/routes/notificationRoutes.js

import { Router } from "express";

import {
  createNotification,
  getAllNotifications,
  getNotificationById,
  markNotificationRead,
  deleteNotification,
} from "../controllers/notificationController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 NOTIFICATION ROUTES
============================================================ */

// 🔍 List Notifications
router.get(
  "/",
  verifyAuth,
  getAllNotifications
);

// 🔍 Single Notification
router.get(
  `/:id(${UUIDv4})`,
  verifyAuth,
  getNotificationById
);

// ➕ Create Notification
router.post(
  "/",
  verifyAuth,
  createNotification
);

// ✅ Mark Notification Read
router.patch(
  `/:id(${UUIDv4})/read`,
  verifyAuth,
  markNotificationRead
);

// 🗑️ Delete Notification
router.delete(
  `/:id(${UUIDv4})`,
  verifyAuth,
  deleteNotification
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;