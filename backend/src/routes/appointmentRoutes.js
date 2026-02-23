// 📁 backend/src/routes/appointmentRoutes.js
// ============================================================================
// 🧠 Enterprise Appointment Routes – VytalGuard HMS
// 🔹 MASTER-aligned with Consultation lifecycle
// 🔹 Explicit lifecycle only (NO toggle endpoints)
// 🔹 Billing-safe, audit-safe, tenant-safe
// ============================================================================

import { Router } from "express";
import {
  // 📋 CRUD + Listing
  getAllAppointments,
  getAppointmentById,
  getAllAppointmentsLite,
  createAppointment,
  updateAppointment,
  deleteAppointment,

  // 🔄 Explicit Lifecycle
  activateAppointment,
  completeAppointment,
  cancelAppointment,
  markNoShowAppointment,
  voidAppointment,
  verifyAppointment,
  restoreAppointment,
} from "../controllers/appointmentController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 APPOINTMENT ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllAppointments);
router.get("/lite", verifyAuth, getAllAppointmentsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth, getAppointmentById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth, createAppointment);
router.put(`/:id(${UUIDv4})`, verifyAuth, updateAppointment);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteAppointment);

/* ============================================================
   📌 LIFECYCLE ROUTES (MASTER – EXPLICIT ONLY)
============================================================ */

// ⏱️ scheduled → in_progress
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth, activateAppointment);

// ✅ in_progress → completed
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth, completeAppointment);

// 🚫 scheduled / in_progress → cancelled
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth, cancelAppointment);

// 👤 scheduled → no_show
router.patch(`/:id(${UUIDv4})/no-show`, verifyAuth, markNoShowAppointment);

// 💸 any → voided (billing rollback)
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidAppointment);

// 🔏 completed → verified
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth, verifyAppointment);

// ♻️ cancelled / no_show / voided → scheduled
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth, restoreAppointment);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
