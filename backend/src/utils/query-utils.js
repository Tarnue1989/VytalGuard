// 📁 backend/src/utils/query-utils.js

/**
 * 🧭 validatePaginationStrict
 * ------------------------------------------------------------
 * Validates that limit/page are numeric and positive.
 * Rejects invalid inputs with a clean 400-level error object.
 * Returns safe, bounded values for Sequelize queries.
 */
export function validatePaginationStrict(req, defaults = { limit: 25, maxLimit: 200 }) {
  const rawLimit = req.query.limit || req.body.limit;
  const rawPage = req.query.page || req.body.page;

  // Convert safely to integers
  const limit = parseInt(rawLimit, 10);
  const page = parseInt(rawPage, 10);

  // 🚨 Strict validation — reject invalid numeric inputs
  if (rawLimit !== undefined && (isNaN(limit) || limit <= 0)) {
    const err = new Error(`Invalid "limit" value: ${rawLimit}. Must be a positive integer.`);
    err.statusCode = 400;
    throw err;
  }

  if (rawPage !== undefined && (isNaN(page) || page <= 0)) {
    const err = new Error(`Invalid "page" value: ${rawPage}. Must be a positive integer.`);
    err.statusCode = 400;
    throw err;
  }

  // ✅ Apply defaults only when not sent
  const safeLimit = rawLimit === undefined ? defaults.limit : Math.min(limit, defaults.maxLimit);
  const safePage = rawPage === undefined ? 1 : page;

  const offset = (safePage - 1) * safeLimit;

  return {
    limit: safeLimit,          // safe validated limit
    page: safePage,            // safe validated page
    offset,                    // Sequelize offset
    raw: {                     // raw user-supplied values
      limit: rawLimit,
      page: rawPage,
    },
  };
}
