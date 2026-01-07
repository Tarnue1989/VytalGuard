// 📁 backend/src/routes/supplierRoutes.js
import { Router } from "express";
import {
  getAllSuppliers,
  getAllSuppliersLite,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  toggleSupplierStatus,
} from "../controllers/supplierController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 SUPPLIER ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllSuppliers);
router.get("/lite", verifyAuth,  getAllSuppliersLite);
router.get("/lite/list", verifyAuth,  getAllSuppliersLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getSupplierById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createSupplier);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateSupplier);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteSupplier);

// 🔄 Toggle status (active ↔ inactive)
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleSupplierStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
