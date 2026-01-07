import Joi from "joi";

/* ============================================================
   🧠 Normalize Joi errors into UX-friendly format
============================================================ */
function normalizeJoiErrors(error, labelMap = {}) {
  if (!error?.details) return [];

  return error.details.map((d) => {
    const field = d.path?.[0];
    return {
      field,
      message:
        labelMap[field] ||
        d.message.replace(/["]/g, ""),
    };
  });
}

/* ============================================================
   Validate helper
============================================================ */
export function validate(schema, payload, labelMap = {}) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      value: null,
      errors: normalizeJoiErrors(error, labelMap),
    };
  }

  return { value, errors: null };
}

/* ============================================================
   Express middleware
============================================================ */
export function validateRequest(schema, type = "body", labelMap = {}) {
  return (req, res, next) => {
    const { value, errors } = validate(schema, req[type], labelMap);

    if (errors) {
      return res.status(400).json({
        success: false,
        errors, // ✅ structured, reusable, ethical
      });
    }

    req[type] = value;
    next();
  };
}
