// 📁 backend/src/routes/appointmentRoutes.js
// ============================================================================
// 🧠 Enterprise Appointment Routes – VytalGuard HMS
// 🔹 Aligned with Consultation, Vital, and Central Stock master patterns
// 🔹 Includes full lifecycle control: activate, complete, cancel, void, verify, restore
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

  // 🔄 Status & Lifecycle
  toggleAppointmentStatus,
  activateAppointment,
  completeAppointment,
  cancelAppointment,
  markNoShowAppointment,
  voidAppointment,
  verifyAppointment,
  restoreAppointment, // ✅ Added for full enterprise lifecycle
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
router.get("/", verifyAuth,  getAllAppointments);
router.get("/lite", verifyAuth,  getAllAppointmentsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getAppointmentById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createAppointment);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateAppointment);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteAppointment);

// 🔄 Toggle (scheduled ↔ cancelled)
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleAppointmentStatus);

/* ============================================================
   📌 LIFECYCLE ROUTES (Enterprise-Aligned)
   ============================================================ */
// ⏱️ Activate scheduled → in_progress
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth,  activateAppointment);

// ✅ Mark in_progress → completed
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeAppointment);

// 🚫 Cancel scheduled/in_progress
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelAppointment);

// 👤 Mark scheduled → no_show
router.patch(`/:id(${UUIDv4})/no-show`, verifyAuth,  markNoShowAppointment);

// 💸 Void charges + mark voided
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidAppointment);

// 🔏 Verification step (admin/doctor finalize)
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyAppointment);

// ♻️ Restore (cancelled/no_show/voided/deleted → scheduled)
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreAppointment);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
