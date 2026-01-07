// 📁 /js/utils/pagination-utils.js

/**
 * 🧭 getSafePaginationParams
 * Ensures frontend always sends valid pagination values.
 * Defaults: page=1, limit=25
 */
export function getSafePaginationParams(currentPage = 1, perPage = 25) {
  let page = parseInt(currentPage, 10);
  let limit = parseInt(perPage, 10);

  if (isNaN(page) || page <= 0) page = 1;
  if (isNaN(limit) || limit <= 0) limit = 25;

  // Cap to match backend maxLimit
  if (limit > 200) limit = 200;

  return { page, limit };
}
