// 📁 backend/src/routes/messageRoutes.js

import { Router } from "express";

import {
  sendMessage,
  getAllMessages,
  getMessageById,
  deleteMessage,
} from "../controllers/messageController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

import {
  uploadMessage,
} from "../middleware/upload.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 MESSAGE ROUTES
============================================================ */

// 🔍 List Messages
router.get(
  "/",
  verifyAuth,
  getAllMessages
);

// 🔍 Single Message
router.get(
  `/:id(${UUIDv4})`,
  verifyAuth,
  getMessageById
);

// ➕ Send Message
router.post(
  "/",
  verifyAuth,
  uploadMessage,
  sendMessage
);

// 🗑️ Delete Message
router.delete(
  `/:id(${UUIDv4})`,
  verifyAuth,
  deleteMessage
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;