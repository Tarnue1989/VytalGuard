// 📁 backend/src/utils/queryHelper.js
import { Op } from "sequelize";

/* ============================================================
   🧠 Enterprise Query Helper (Sequelize)
   ============================================================ */

/* ============================================================
   🛡️ UUID SAFETY HELPERS
============================================================ */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ✅ EXPORT THIS (ONLY FIX)
export function isValidUUID(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function isUUIDField(field) {
  return (
    field.endsWith("_id") ||
    field === "id" ||
    field === "organization_id" ||
    field === "facility_id" ||
    field === "user_id" ||
    field === "role_id"
  );
}

export function buildQueryOptions(
  req,
  configOrSortBy = "created_at",
  defaultSortOrder = "DESC",
  validColumns = []
) {
  const isConfigObject =
    typeof configOrSortBy === "object" && !Array.isArray(configOrSortBy);

  const {
    model = null,
    defaultSort = ["created_at", "DESC"],
    allowedFilters = [],
    allowedSearchFields = [],
    include = [],
    fields = [],
  } = isConfigObject ? configOrSortBy : {};

  const defaultSortBy = isConfigObject ? defaultSort[0] : configOrSortBy;
  const defaultOrder = isConfigObject ? defaultSort[1] : defaultSortOrder;
  const validCols = isConfigObject ? fields : validColumns;

  const {
    page = 1,
    limit = 10,
    sort_by,
    sort_order = defaultOrder,
    search,
    fields: fieldStr,
    ...filters
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const where = {};

  /* ============================================================
     🚫 Remove meta / UI-only query params
  ============================================================ */
  const excludedMetaKeys = [
    "global", "search", "q",
    "page", "limit", "sort_by", "sort_order",
    "modelType", "moduleType",
    "groupField", "aggregate_by",
    "date_range", "format",
    "fields", "from_date", "to_date",
    "_ts",
  ];

  for (const key of excludedMetaKeys) {
    delete filters[key];
  }

  /* ============================================================
     🔍 Operator Map
  ============================================================ */
  const operatorMap = {
    eq: Op.eq,
    ne: Op.ne,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
    like: Op.iLike,
    in: Op.in,
    between: Op.between,
    contains: Op.contains,
  };

  /* ============================================================
     🔍 Filter Parsing (UUID SAFE)
  ============================================================ */
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;

    // 🛡️ HARD BLOCK invalid UUIDs
    if (isUUIDField(key)) {
      if (Array.isArray(value)) {
        const valid = value.filter(isValidUUID);
        if (!valid.length) continue;
        where[key] = { [Op.in]: valid };
        continue;
      }

      if (!isValidUUID(value)) {
        continue; // ❌ DROP invalid UUID silently
      }

      where[key] = value;
      continue;
    }

    /* ------------------ [gte] ------------------ */
    if (key.includes("[gte]")) {
      const baseKey = key.replace("[gte]", "");
      const date = new Date(value);
      where[baseKey] = {
        ...(where[baseKey] || {}),
        [Op.gte]: !isNaN(date)
          ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
          : value,
      };
      continue;
    }

    /* ------------------ [lte] ------------------ */
    if (key.includes("[lte]")) {
      const baseKey = key.replace("[lte]", "");
      const date = new Date(value);
      where[baseKey] = {
        ...(where[baseKey] || {}),
        [Op.lt]: !isNaN(date)
          ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
          : value,
      };
      continue;
    }

    /* ------------------ object filters ------------------ */
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [opKey, opValue] of Object.entries(value)) {
        const op = operatorMap[opKey];
        if (!op) continue;

        if (opValue === "null") {
          where[key] = op === Op.ne ? { [Op.not]: null } : { [Op.is]: null };
          continue;
        }

        if (op === Op.in || op === Op.between) {
          where[key] = { [op]: String(opValue).split(",") };
        } else if (op === Op.iLike) {
          where[key] = { [op]: `%${opValue}%` };
        } else {
          where[key] = { ...(where[key] || {}), [op]: opValue };
        }
      }
    } else {
      where[key] = value === "null" ? { [Op.is]: null } : value;
    }
  }

  /* ============================================================
     📅 Date Range Shortcuts
  ============================================================ */
  if (req.query.date_range && !filters["created_at[gte]"]) {
    const now = new Date();
    let fromDate;
    let toDate = new Date();

    switch (req.query.date_range) {
      case "today":
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case "last_7_days":
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case "month_to_date":
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case "year_to_date":
        fromDate = new Date(now.getFullYear(), 0, 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
    }

    if (fromDate) {
      where.created_at = { [Op.between]: [fromDate, toDate] };
    }
  }

  /* ============================================================
     ⚙️ Sorting + Attributes
  ============================================================ */
  let sortColumn = sort_by?.trim() || defaultSortBy;
  const colWhitelist = validCols.length ? validCols : allowedFilters;

  if (colWhitelist.length && !colWhitelist.includes(sortColumn)) {
    sortColumn = colWhitelist.includes(defaultSortBy)
      ? defaultSortBy
      : colWhitelist[0];
  }

  const order = [
    [sortColumn, sort_order?.toUpperCase() === "DESC" ? "DESC" : "ASC"],
  ];

  let attributes;

  // 🔹 Explicit fields from query (?fields=...)
  if (fieldStr) {
    attributes = fieldStr
      .split(",")
      .map(f => f.trim())
      .filter(Boolean)
      .filter(f => !["global", "search"].includes(f));

    if (colWhitelist.length) {
      attributes = attributes.filter(f => colWhitelist.includes(f));
    }
  }

  // 🔹 RBAC fallback: use allowed columns explicitly
  if (!attributes && colWhitelist.length) {
    attributes = [...colWhitelist];
  }

  /* ============================================================
     🚀 Final Return
  ============================================================ */
  return {
    model,
    where,
    include,
    order,
    offset,
    limit: parseInt(limit),
    pagination: { page: parseInt(page), limit: parseInt(limit) },
    search,
    attributes,
  };
}

// ✅ Enterprise export
export const queryHelper = { buildQueryOptions };
