import { fxService } from "../services/fxService.js";
import { success, error } from "../utils/response.js";

export const convertCurrency = async (req, res) => {
  try {
    const { amount, from_currency, to_currency } = req.body;

    // 🔥 HARD GUARD (VERY IMPORTANT)
    if (!amount || !from_currency || !to_currency) {
      return error(res, "Missing conversion parameters", null, 400);
    }

    const orgId = req.user?.organization_id || null;
    const facilityId = req.user?.facility_id || null;

    const result = await fxService.convert({
      amount,
      from_currency,
      to_currency,
      orgId,
      facilityId,
    });

    return success(res, "✅ Conversion successful", result);

  } catch (err) {
    console.error("❌ FX ERROR:", err); // 🔥 ADD THIS FOR DEBUG
    return error(res, err.message || "❌ FX conversion failed", err);
  }
};