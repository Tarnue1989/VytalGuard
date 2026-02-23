// 📁 backend/src/routes/registrationLogRoutes.js
import { Router } from "express";
import {
  getAllRegistrationLogs,
  getRegistrationLogById,
  createRegistrationLog,
  updateRegistrationLog,
  deleteRegistrationLog,
  submitRegistrationLog,
  activateRegistrationLog,
  completeRegistrationLog,
  cancelRegistrationLog,
  voidRegistrationLog,
} from "../controllers/registrationLogController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 REGISTRATION LOG ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllRegistrationLogs);
router.get(`/:id(${UUIDv4})`, verifyAuth, getRegistrationLogById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth, createRegistrationLog);
router.put(`/:id(${UUIDv4})`, verifyAuth, updateRegistrationLog);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteRegistrationLog);

/* ============================================================
   📌 LIFECYCLE ROUTES (MASTER)
============================================================ */
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth, submitRegistrationLog);
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth, activateRegistrationLog);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth, completeRegistrationLog);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth, cancelRegistrationLog);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidRegistrationLog);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
