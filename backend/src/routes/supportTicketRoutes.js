// 📁 backend/src/routes/supportTicketRoutes.js

import { Router } from "express";

import {
  createTicket,
  getAllTickets,
  getTicketById,

  assignTicket,
  resolveTicket,
  closeTicket,

  reopenTicket,
  escalateTicket,

  addInternalNote,
  getTicketActivities,

  deleteTicket,
} from "../controllers/supportTicketController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 SUPPORT TICKET ROUTES
============================================================ */

// 🔍 List Tickets
router.get(
  "/",
  verifyAuth,
  getAllTickets
);

// 🔍 Single Ticket
router.get(
  `/:id(${UUIDv4})`,
  verifyAuth,
  getTicketById
);

// ➕ Create Ticket
router.post(
  "/",
  verifyAuth,
  createTicket
);

// 👤 Assign Ticket
router.patch(
  `/:id(${UUIDv4})/assign`,
  verifyAuth,
  assignTicket
);

// ⚠️ Escalate Ticket
router.patch(
  `/:id(${UUIDv4})/escalate`,
  verifyAuth,
  escalateTicket
);

// ✅ Resolve Ticket
router.patch(
  `/:id(${UUIDv4})/resolve`,
  verifyAuth,
  resolveTicket
);

// 🔄 Reopen Ticket
router.patch(
  `/:id(${UUIDv4})/reopen`,
  verifyAuth,
  reopenTicket
);

// 🔒 Close Ticket
router.patch(
  `/:id(${UUIDv4})/close`,
  verifyAuth,
  closeTicket
);

// 📝 Add Internal Note
router.post(
  `/:id(${UUIDv4})/notes`,
  verifyAuth,
  addInternalNote
);

// 📜 Ticket Activities
router.get(
  `/:id(${UUIDv4})/activities`,
  verifyAuth,
  getTicketActivities
);

// 🗑️ Delete Ticket
router.delete(
  `/:id(${UUIDv4})`,
  verifyAuth,
  deleteTicket
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;