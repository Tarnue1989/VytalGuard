// 📁 backend/src/routes/userRoutes.js
import { Router } from "express";
import { body } from "express-validator";
import {
  getAllUsers,
  getUserById,
  getAllUsersLite,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  toggleUserRoleStatus,
  resetUserPassword,
  adminGenerateResetToken,
  manualResetPassword,
  unlockUser,
  requirePasswordReset,
  revokeUserSessions,
  purgeUser,
} from "../controllers/userController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

/* ============================================================
   📌 USER ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllUsers);
router.get("/lite/all", verifyAuth, getAllUsersLite);

/* ============================================================
   📌 PUBLIC PASSWORD RESET (no auth)
   ============================================================ */
router.post(
  "/manual-reset-password",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("token").notEmpty().withMessage("Reset token is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  manualResetPassword
);

/* ============================================================
   📌 PASSWORD / ACCOUNT MANAGEMENT
   ============================================================ */
router.post("/generate-reset-token", verifyAuth, adminGenerateResetToken);
router.put("/:id/reset-password", verifyAuth, resetUserPassword);
router.put("/:id/unlock", verifyAuth, unlockUser);
router.put("/:id/require-password-reset", verifyAuth, requirePasswordReset);
router.put("/:id/revoke-sessions", verifyAuth, revokeUserSessions);

/* ============================================================
   📌 ROLE & STATUS MANAGEMENT
   ============================================================ */
router.put(
  "/:userId/facility/:facilityId/role/:roleId/toggle-status",
  verifyAuth,
  toggleUserRoleStatus
);
router.put("/:id/toggle-status", verifyAuth, toggleUserStatus);

/* ============================================================
   📌 CORE CRUD ROUTES
   ============================================================ */
router.post("/", verifyAuth, createUser);
router.get("/:id", verifyAuth, getUserById);
router.put("/:id", verifyAuth, updateUser);
router.delete("/:id", verifyAuth, deleteUser);
router.delete("/:id/purge", verifyAuth, purgeUser);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
