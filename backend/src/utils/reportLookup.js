// 📁 backend/src/utils/reportLookup.js
// ============================================================================
// 🧠 Enterprise Report FK Resolver Utility
// Safely resolves foreign key IDs to human-readable labels
// ============================================================================

/**
 * @param {string} field - the foreign key column (e.g. "category_id")
 * @param {string} value - the UUID value to look up
 * @returns {Promise<string|null>} resolved label or null
 */
export async function resolveFKName(field, value) {
  if (!value) return null;

  try {
    // Lazy import avoids circular deps
    const {
      Organization,
      Facility,
      Department,
      Employee,
      MasterItem,
      MasterItemCategory,
    } = await import("../models/index.js");

    switch (field) {
      /* ========================
         🔹 Core Tenant Scopes
      ======================== */
      case "organization_id": {
        const org = await Organization.findByPk(value, { attributes: ["name"] });
        return org?.name || "(Unknown Organization)";
      }
      case "facility_id": {
        const fac = await Facility.findByPk(value, { attributes: ["name"] });
        return fac?.name || "(Unknown Facility)";
      }

      /* ========================
         🔹 Human / Staff
      ======================== */
      case "doctor_id":
      case "employee_id":
      case "created_by_id":
      case "updated_by_id":
      case "deleted_by_id": {
        const emp = await Employee.findByPk(value, {
          attributes: ["first_name", "middle_name", "last_name"],
        });
        return emp
          ? [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(" ")
          : "(Unknown Employee)";
      }

      /* ========================
         🔹 Clinical / Catalog
      ======================== */
      case "category_id": {
        const cat = await MasterItemCategory.findByPk(value, { attributes: ["name"] });
        return cat?.name || "(Uncategorized)";
      }
      case "master_item_id": {
        const mi = await MasterItem.findByPk(value, { attributes: ["name"] });
        return mi?.name || "(Unknown Item)";
      }
      case "department_id": {
        const dep = await Department.findByPk(value, { attributes: ["name"] });
        return dep?.name || "(Unknown Department)";
      }

      /* ========================
         🔹 Default fallback
      ======================== */
      default:
        return null;
    }
  } catch (err) {
    console.warn(`[resolveFKName] Failed to resolve ${field}: ${err.message}`);
    return null;
  }
}
