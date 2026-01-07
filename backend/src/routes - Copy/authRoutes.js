// 📁 backend/src/routes/authRoutes.js
import { Router } from "express";
import { body } from "express-validator";

import {
  login,
  refresh,
  logout,
  logoutAll,
  register,
  me,
  changePassword,
  manualResetPassword,
  forceResetPassword,
} from "../controllers/authController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";
import roleGuard from "../middleware/roleGuard.js";
//

const router = Router();

/* ============================================================
   🔐 AUTH ROUTES
============================================================ */

/* -------------------- Register -------------------- */
// 🔹 Register (facility-scoped, admin only)
router.post(
  "/register",
  verifyAuth,
  roleGuard(["admin", "superadmin"]),
  
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role_id").notEmpty().withMessage("Role is required"),
  ],
  register
);

/* -------------------- Login -------------------- */
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login
);

/* -------------------- Refresh -------------------- */
router.post("/refresh", refresh);

/* -------------------- Me -------------------- */
router.get("/me", verifyAuth,  me);

/* -------------------- Change Password (AUTH) -------------------- */
// 🔹 Logged-in users changing their own password
router.post(
  "/change-password",
  verifyAuth,
  
  [
    body("oldPassword").notEmpty().withMessage("Old password required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  changePassword
);

/* -------------------- Force Password Reset (NO AUTH) -------------------- */
// 🔹 Forced reset when must_reset_password === true
router.post(
  "/force-reset-password",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  forceResetPassword
);

/* -------------------- Logout -------------------- */
// 🔹 Logout (current device)
router.post("/logout", verifyAuth,  logout);

// 🔹 Logout all devices
router.post("/logout-all", verifyAuth,  logoutAll);

/* -------------------- Manual Reset via Token -------------------- */
// 🔹 Forgot-password email/token flow (public)
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

export default router;
