// 📁 backend/src/controllers/notificationController.js
// ============================================================================
// 🔔 Notification Controller – Enterprise Master Pattern
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";

import {
  sequelize,

  Notification,

  Organization,
  Facility,

  User,
} from "../models/index.js";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_NOTIFICATION } from "../constants/fieldVisibility.js";

import { success, error } from "../utils/response.js";

import { buildQueryOptions } from "../utils/queryHelper.js";

import { validatePaginationStrict } from "../utils/query-utils.js";

import { normalizeDateRangeLocal } from "../utils/date-utils.js";

import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";

import { validate } from "../utils/validation.js";

import {
  isSuperAdmin,
} from "../utils/role-utils.js";

import { makeModuleLogger } from "../utils/debugLogger.js";

import { authzService } from "../services/authzService.js";

import { auditService } from "../services/auditService.js";

import notificationService from "../services/notificationService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "notifications";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;

const debug = makeModuleLogger(
  "notificationController",
  DEBUG_OVERRIDE
);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const NOTIFICATION_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
  },

  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code"],
    required: false,
  },

  {
    model: User,
    as: "user",
    attributes: [
      "id",
      "first_name",
      "last_name",
      "email",
    ],
  },

  {
    model: User,
    as: "createdBy",
    attributes: [
      "id",
      "first_name",
      "last_name",
    ],
  },
];

/* ============================================================
   📋 VALIDATION SCHEMA
============================================================ */
function buildNotificationSchema(
  mode = "create"
) {
  const base = {
    user_id: Joi.string()
      .uuid()
      .required(),

    title: Joi.string()
      .max(255)
      .required(),

    message: Joi.string()
      .required(),

    type: Joi.string()
      .valid(
        ...Object.values(
          NOTIFICATION_TYPES
        )
      )
      .required(),

    reference_type: Joi.string()
      .allow(null, ""),

    reference_id: Joi.string()
      .uuid()
      .allow(null),

    channel: Joi.string()
      .allow(null, ""),

    delivery_status:
      Joi.string()
        .allow(null, ""),

    metadata: Joi.object()
      .allow(null),

    organization_id:
      Joi.forbidden(),

    facility_id:
      Joi.forbidden(),

    status:
      Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] =
        base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE NOTIFICATION
============================================================ */
export const createNotification =
  async (req, res) => {
    try {
      const allowed =
        await authzService.checkPermission({
          user:req.user,
          module:MODULE_KEY,
          action:"create",
          res,
        });

      if (!allowed) return;

      const { value, errors } =
        validate(
          buildNotificationSchema(
            "create"
          ),
          req.body
        );

      if (errors) {
        return error(
          res,
          "Validation failed",
          errors,
          400
        );
      }

      const { orgId, facilityId } =
        resolveOrgFacility({
          user:req.user,
          value,
          body:req.body,
        });

      const record =
        await notificationService.createNotification({
          ...value,

          organization_id:orgId,
          facility_id:facilityId,

          channel:
            value.channel ||
            "system",

          delivery_status:
            value.delivery_status ||
            "pending",

          metadata:
            value.metadata || {},

          created_by:
            req.user?.id || null,
        });

      const full =
        await Notification.findByPk(
          record.id,
          {
            include:
              NOTIFICATION_INCLUDES,
          }
        );

      await auditService.logAction({
        user:req.user,
        module:MODULE_KEY,
        action:"create",
        entityId:record.id,
        entity:full,
      });

      return success(
        res,
        "✅ Notification created",
        full
      );
    } catch (err) {
      debug.error(
        "createNotification → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to create notification",
        err
      );
    }
  };
  /* ============================================================
   📌 GET ALL NOTIFICATIONS
============================================================ */
export const getAllNotifications =
  async (req, res) => {
    try {
      const allowed =
        await authzService.checkPermission({
          user:req.user,
          module:MODULE_KEY,
          action:"read",
          res,
        });

      if (!allowed) return;

      const {
        limit,
        page,
        offset,
      } = validatePaginationStrict(
        req,
        {
          limit:25,
          maxLimit:200,
        }
      );

      const role =
        (
          req.user?.roleNames?.[0] ||
          "staff"
        ).toLowerCase();

      const visibleFields =
        FIELD_VISIBILITY_NOTIFICATION[
          role
        ] ||
        FIELD_VISIBILITY_NOTIFICATION.staff;

      const options =
        buildQueryOptions(
          req,
          "created_at",
          "DESC",
          visibleFields
        );

      options.where = {
        [Op.and]: [],
      };

      /* ========================================================
         🔐 TENANT SCOPE
      ======================================================== */
      if (!isSuperAdmin(req.user)) {
        options.where[Op.and].push({
          organization_id:
            req.user.organization_id,
        });

        if (
          Array.isArray(
            req.user.facility_ids
          ) &&
          req.user.facility_ids
            .length > 0
        ) {
          options.where[Op.and].push({
            [Op.or]: [
              {
                facility_id: {
                  [Op.in]:
                    req.user.facility_ids,
                },
              },

              {
                facility_id:null,
              },
            ],
          });
        }
      }

      /* ========================================================
         🔎 SEARCH
      ======================================================== */
      if (options.search) {
        options.where[Op.and].push({
          [Op.or]: [
            {
              title: {
                [Op.iLike]:
                  `%${options.search}%`,
              },
            },

            {
              message: {
                [Op.iLike]:
                  `%${options.search}%`,
              },
            },
          ],
        });
      }

      /* ========================================================
         📆 DATE RANGE
      ======================================================== */
      if (req.query.dateRange) {
        const {
          start,
          end,
        } = normalizeDateRangeLocal(
          req.query.dateRange
        );

        if (start && end) {
          options.where[Op.and].push({
            created_at: {
              [Op.between]: [
                start,
                end,
              ],
            },
          });
        }
      }

      /* ========================================================
         📌 STATUS
      ======================================================== */
      if (req.query.status) {
        options.where[Op.and].push({
          status:req.query.status,
        });
      }

      /* ========================================================
         📌 TYPE
      ======================================================== */
      if (req.query.type) {
        options.where[Op.and].push({
          type:req.query.type,
        });
      }

      /* ========================================================
         📌 CHANNEL
      ======================================================== */
      if (req.query.channel) {
        options.where[Op.and].push({
          channel:req.query.channel,
        });
      }

      /* ========================================================
         📌 DELIVERY STATUS
      ======================================================== */
      if (req.query.delivery_status) {
        options.where[Op.and].push({
          delivery_status:
            req.query.delivery_status,
        });
      }

      /* ========================================================
         📌 SEEN FILTER
      ======================================================== */
      if (req.query.is_seen) {
        options.where[Op.and].push({
          is_seen:
            req.query.is_seen === "true",
        });
      }

      const { count, rows } =
        await Notification.findAndCountAll({
          where:options.where,

          include:
            NOTIFICATION_INCLUDES,

          order:options.order,

          offset,
          limit,

          distinct:true,
        });

      await auditService.logAction({
        user:req.user,
        module:MODULE_KEY,
        action:"list",
        details:{
          query:req.query,
          returned:count,
        },
      });

      return success(
        res,
        "✅ Notifications loaded",
        {
          records: rows,

          pagination: {
            total: count,
            page,
            pageCount:
              Math.ceil(
                count / limit
              ),
          },
        }
      );
    } catch (err) {
      debug.error(
        "getAllNotifications → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to load notifications",
        err
      );
    }
  };

/* ============================================================
   📌 GET NOTIFICATION BY ID
============================================================ */
export const getNotificationById =
  async (req, res) => {
    try {
      const allowed =
        await authzService.checkPermission({
          user:req.user,
          module:MODULE_KEY,
          action:"read",
          res,
        });

      if (!allowed) return;

      const record =
        await Notification.findByPk(
          req.params.id,
          {
            include:
              NOTIFICATION_INCLUDES,
          }
        );

      if (!record) {
        return error(
          res,
          "Notification not found",
          null,
          404
        );
      }

      return success(
        res,
        "✅ Notification loaded",
        record
      );
    } catch (err) {
      debug.error(
        "getNotificationById → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to load notification",
        err
      );
    }
  };
/* ============================================================
   📌 MARK AS READ
============================================================ */
export const markNotificationRead =
  async (req, res) => {
    try {
      const allowed =
        await authzService.checkPermission({
          user:req.user,
          module:MODULE_KEY,
          action:"update",
          res,
        });

      if (!allowed) return;

      const record =
        await notificationService.markRead(
          req.params.id
        );

      await auditService.logAction({
        user:req.user,
        module:MODULE_KEY,
        action:"mark_read",
        entityId:record.id,
        entity:record,
      });

      return success(
        res,
        "✅ Notification marked as read",
        record
      );
    } catch (err) {
      debug.error(
        "markNotificationRead → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to mark notification as read",
        err
      );
    }
  };

/* ============================================================
   📌 DELETE NOTIFICATION
============================================================ */
export const deleteNotification =
  async (req, res) => {
    const t =
      await sequelize.transaction();

    try {
      const allowed =
        await authzService.checkPermission({
          user:req.user,
          module:MODULE_KEY,
          action:"delete",
          res,
        });

      if (!allowed) return;

      const record =
        await Notification.findByPk(
          req.params.id,
          {
            transaction:t,
          }
        );

      if (!record) {
        await t.rollback();

        return error(
          res,
          "Notification not found",
          null,
          404
        );
      }

      await record.destroy({
        transaction:t,
      });

      await t.commit();

      await auditService.logAction({
        user:req.user,
        module:MODULE_KEY,
        action:"delete",
        entityId:record.id,
        entity:record,
      });

      return success(
        res,
        "✅ Notification deleted"
      );
    } catch (err) {
      await t.rollback();

      debug.error(
        "deleteNotification → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to delete notification",
        err
      );
    }
  };