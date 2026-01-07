import Joi from "joi";
import {
  UniqueConstraintError,
  ForeignKeyConstraintError,
  ValidationError as SequelizeValidationError,
} from "sequelize";
import { logger } from "../utils/logger.js";
import { auditService } from "../services/auditService.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
   true  = debug ON for error handler
   false = debug OFF for error handler
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 usually OFF
const debug = makeModuleLogger("errorHandler", DEBUG_OVERRIDE);

const { ValidationError: JoiValidationError } = Joi;

/* ============================================================
   🚫 404 HANDLER
============================================================ */
export function notFound(req, _res, next) {
  const err = new Error(`Not Found - ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

/* ============================================================
   🚨 GLOBAL ERROR HANDLER
============================================================ */
export async function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Internal Server Error";
  let errors = [];
  let code = "ERR_UNKNOWN";

  /* ============================================================
     🧪 DEBUG — RAW ERROR CONTEXT
  ============================================================ */
  debug.log("RAW ERROR RECEIVED", {
    status,
    message,
    stack: err.stack,
    path: req.originalUrl,
  });

  /* ============================================================
     🧩 ERROR TYPE RESOLUTION
  ============================================================ */

  // Joi validation error
  if (err instanceof JoiValidationError) {
    status = 400;
    code = "ERR_VALIDATION";
    message = "Validation failed";
    errors = err.details.map((d) => ({
      field: d.context?.key,
      message: d.message.replace(/['"]/g, ""),
    }));
  }

  // Sequelize unique constraint
  else if (err instanceof UniqueConstraintError) {
    status = 409; // Conflict
    code = "ERR_DUPLICATE";
    message = "Duplicate value error";
    errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Sequelize foreign key constraint
  else if (err instanceof ForeignKeyConstraintError) {
    status = 400;
    code = "ERR_FOREIGN_KEY";
    message = "Invalid reference";
    errors.push({
      field: err.index,
      message: "Referenced record not found",
    });
  }

  // Sequelize general validation errors
  else if (err instanceof SequelizeValidationError) {
    status = 400;
    code = "ERR_DB_VALIDATION";
    message = "Database validation failed";
    errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  /* ============================================================
     📤 RESPONSE PAYLOAD
  ============================================================ */
  const payload = {
    code,
    message,
    details: errors.length ? errors : undefined,
  };

  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  /* ============================================================
     🚨 SYSTEM LOG — ALWAYS ON
  ============================================================ */
  logger.error("[errorHandler]", {
    status,
    code,
    message,
    errors,
    stack: err.stack,
  });

  /* ============================================================
     🔍 AUDIT SEVERITY MAPPING
  ============================================================ */
  let severity = "error";
  if (status >= 500) {
    severity = "critical";
  } else if (status >= 400) {
    severity = "validation";
  }

  debug.log("AUDIT ERROR MAPPED", {
    severity,
    module: req.baseUrl || "system",
    userId: req.user?.id || null,
  });

  /* ============================================================
     🧾 AUDIT LOG — ALWAYS ON
  ============================================================ */
  await auditService.logError({
    module: req.baseUrl || "system",
    error: err,
    user: req.user || {},
    transaction: null,
    severity,
  });

  return res.status(status).json({
    success: false,
    error: payload,
  });
}
