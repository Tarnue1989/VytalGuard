// 📁 controllers/organizationBrandingController.js – FINAL (PATIENT-STYLE REMOVE)

import Joi from "joi";
import fs from "fs";
import path from "path";

import { sequelize, OrganizationBranding } from "../models/index.js";

import { success, error } from "../utils/response.js";
import { THEME_STATUS } from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

import { makeModuleLogger } from "../utils/debugLogger.js";

const MODULE_KEY = "organization_branding";
const debug = makeModuleLogger("organizationBrandingController", true);

/* ============================================================
   📋 VALIDATION
============================================================ */
const brandingSchema = Joi.object({
  logo_url: Joi.string().allow("", null),
  logo_print_url: Joi.string().allow("", null),
  favicon_url: Joi.string().allow("", null),

  company_name: Joi.string().allow("", null),
  tagline: Joi.string().allow("", null),

  theme: Joi.object().optional(),

  letterhead_header: Joi.string().allow("", null),
  letterhead_footer: Joi.string().allow("", null),

  contact: Joi.object().optional(),
  social_links: Joi.object().optional(),

  currency: Joi.string().allow("", null),
  locale: Joi.string().allow("", null),
  timezone: Joi.string().allow("", null),

  status: Joi.string().valid(...Object.values(THEME_STATUS)).optional(),

  // 🔥 REMOVE FLAGS (IMPORTANT)
  remove_logo: Joi.alternatives().try(Joi.boolean(), Joi.string()),
  remove_logo_print: Joi.alternatives().try(Joi.boolean(), Joi.string()),
  remove_favicon: Joi.alternatives().try(Joi.boolean(), Joi.string()),
});

/* ============================================================
   📌 GET
============================================================ */
export const getBranding = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      res,
    });
    if (!allowed) return;

    const branding = await OrganizationBranding.findOne({
      where: { organization_id: req.user.organization_id },
    });

    return success(res, "✅ Branding loaded", branding);
  } catch (err) {
    debug.error(err);
    return error(res, "❌ Failed to load branding", err);
  }
};

/* ============================================================
   📌 UPSERT (🔥 FULL REMOVE SUPPORT)
============================================================ */
export const upsertBranding = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    /* ================= VALIDATE ================= */
    const { error: validationError, value } = brandingSchema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const orgId = req.user.organization_id;

    /* ============================================================
       🔄 NORMALIZE REMOVE FLAGS
    ============================================================ */
    ["remove_logo", "remove_logo_print", "remove_favicon"].forEach((flag) => {
      if (req.body[flag] === "true") req.body[flag] = true;
      if (req.body[flag] === "false") req.body[flag] = false;
    });

    /* ============================================================
       🔎 LOAD EXISTING (FOR CLEANUP)
    ============================================================ */
    let branding = await OrganizationBranding.findOne({
      where: { organization_id: orgId },
      transaction: t,
    });

    const payload = { ...value };

    /* ============================================================
       🧹 FILE CLEANUP (PATIENT STYLE)
    ============================================================ */
    if (branding) {
      try {
        if (req.body.remove_logo && branding.logo_url) {
          fs.unlinkSync(path.join(process.cwd(), branding.logo_url));
          payload.logo_url = null;
        }

        if (req.body.remove_logo_print && branding.logo_print_url) {
          fs.unlinkSync(path.join(process.cwd(), branding.logo_print_url));
          payload.logo_print_url = null;
        }

        if (req.body.remove_favicon && branding.favicon_url) {
          fs.unlinkSync(path.join(process.cwd(), branding.favicon_url));
          payload.favicon_url = null;
        }
      } catch (err) {
        debug.warn("File cleanup warning:", err.message);
      }
    }

    /* ============================================================
       📁 FILE UPLOAD (REPLACE)
    ============================================================ */
    if (req.files?.logo?.[0]) {
      payload.logo_url = `/uploads/logos/${req.files.logo[0].filename}`;
    }

    if (req.files?.logo_print?.[0]) {
      payload.logo_print_url = `/uploads/logos/${req.files.logo_print[0].filename}`;
    }

    if (req.files?.favicon?.[0]) {
      payload.favicon_url = `/uploads/favicons/${req.files.favicon[0].filename}`;
    }

    /* ============================================================
       🔁 UPSERT
    ============================================================ */
    if (branding) {
      await branding.update(
        {
          ...payload,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
    } else {
      branding = await OrganizationBranding.create(
        {
          organization_id: orgId,
          ...payload,
          created_by_id: req.user.id,
        },
        { transaction: t }
      );
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "upsert",
      entityId: branding.id,
      entity: branding,
    });

    return success(res, "✅ Branding saved", branding);
  } catch (err) {
    await t.rollback();
    debug.error(err);
    return error(res, "❌ Failed to save branding", err);
  }
};