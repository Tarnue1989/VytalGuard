// 📁 backend/src/routes/conversationRoutes.js

import { Router } from "express";

import {
  createConversation,
  getAllConversations,
  getConversationById,

  archiveConversation,
  lockConversation,

  addParticipant,
  removeParticipant,

  deleteConversation,
} from "../controllers/conversationController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 CONVERSATION ROUTES
============================================================ */

// 🔍 List Conversations
router.get(
  "/",
  verifyAuth,
  getAllConversations
);

// 🔍 Single Conversation
router.get(
  `/:id(${UUIDv4})`,
  verifyAuth,
  getConversationById
);

// ➕ Create Conversation
router.post(
  "/",
  verifyAuth,
  createConversation
);

// 📦 Archive Conversation
router.patch(
  `/:id(${UUIDv4})/archive`,
  verifyAuth,
  archiveConversation
);

// 🔒 Lock Conversation
router.patch(
  `/:id(${UUIDv4})/lock`,
  verifyAuth,
  lockConversation
);

// ➕ Add Participant
router.post(
  `/:id(${UUIDv4})/participants`,
  verifyAuth,
  addParticipant
);

// ➖ Remove Participant
router.delete(
  `/:id(${UUIDv4})/participants`,
  verifyAuth,
  removeParticipant
);

// 🗑️ Delete Conversation
router.delete(
  `/:id(${UUIDv4})`,
  verifyAuth,
  deleteConversation
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;