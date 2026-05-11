// 📁 backend/src/controllers/messageController.js
// ============================================================================
// 💬 Message Controller – Enterprise Master Pattern
// ----------------------------------------------------------------------------
// 🔹 Full tenant-safe messaging controller
// 🔹 Conversation + message lifecycle support
// 🔹 RBAC permission enforcement
// 🔹 Audit-safe architecture
// 🔹 Dynamic filtering + pagination
// 🔹 Enterprise include structure
// ============================================================================

import Joi from "joi";
import { Op, literal } from "sequelize";

import {
  sequelize,

  Message,
  Conversation,
  ConversationParticipant,
  MessageAttachment,

  Organization,
  Facility,

  Employee,
  Patient,

  User,
} from "../models/index.js";

import {
  MESSAGE_STATUS,
  MESSAGE_TYPES,
  CONVERSATION_STATUS,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_MESSAGE } from "../constants/fieldVisibility.js";

import { success, error } from "../utils/response.js";

import { buildQueryOptions } from "../utils/queryHelper.js";

import { validatePaginationStrict } from "../utils/query-utils.js";

import { normalizeDateRangeLocal } from "../utils/date-utils.js";

import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";

import { validate } from "../utils/validation.js";

import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

import { makeModuleLogger } from "../utils/debugLogger.js";

import { authzService } from "../services/authzService.js";

import { auditService } from "../services/auditService.js";

import messagingService from "../services/messagingService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "messages";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;

const debug = makeModuleLogger(
  "messageController",
  DEBUG_OVERRIDE
);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const MESSAGE_INCLUDES = [
  {
    model: Conversation,
    as: "conversation",
    attributes: [
      "id",
      "topic",
      "conversation_type",
      "status",
      "is_locked",
      "allow_attachments",
    ],
  },

  {
    model: MessageAttachment,
    as: "attachments",
    attributes: {
      exclude: [
        "deleted_at",
        "deleted_by",
      ],
    },
  },

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
    as: "createdBy",
    attributes: [
      "id",
      "first_name",
      "last_name",
    ],
  },
];

/* ============================================================
   📋 MESSAGE SCHEMA
============================================================ */
function buildMessageSchema(mode = "create") {
  const base = {
    conversation_id: Joi.string()
      .uuid()
      .required(),

    sender_id: Joi.string()
      .uuid()
      .required(),

    sender_role: Joi.string()
      .required(),

    receiver_id: Joi.string()
      .uuid()
      .allow(null),

    receiver_role: Joi.string()
      .allow(null),

    content: Joi.string()
      .allow("", null),

    source: Joi.string()
      .allow(null, ""),

    device: Joi.string()
      .allow(null, ""),

    message_type: Joi.string()
      .valid(
        ...Object.values(MESSAGE_TYPES)
      )
      .default(MESSAGE_TYPES.TEXT),

    reply_to_message_id: Joi.string()
      .uuid()
      .allow(null),

    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),

    status: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 SEND MESSAGE
============================================================ */
export const sendMessage = async (
  req,
  res
) => {
  const t = await sequelize.transaction();

  try {
    const allowed =
      await authzService.checkPermission({
        user:req.user,
        module:MODULE_KEY,
        action:"create",
        res,
      });

    if (!allowed) return;

    const { value, errors } = validate(
      buildMessageSchema("create"),
      req.body
    );

    if (errors) {
      await t.rollback();

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

    /* ========================================================
       📎 ATTACHMENTS
    ======================================================== */
    const attachments =
      (
        req.files?.message_attachment ||
        []
      ).map((file) => ({
        file_name:file.filename,

        original_file_name:
          file.originalname,

        file_type:
          file.mimetype.split("/")[0],

        mime_type:file.mimetype,

        file_size:file.size,

        file_path:file.path,

        file_url:
          file.path.replace(/\\/g, "/"),

        checksum:
          file.checksum || null,

        expires_at:
          null,

        is_encrypted:
          false,

        metadata:{},

        storage_provider:
          "local",

        storage_key:
          file.filename,
      }));

    const message =
      await messagingService.sendMessage({
        ...value,

        organization_id:orgId,
        facility_id:facilityId,

        source:
          req.body.source || "web",

        device:
          req.body.device || null,

        attachments,

        created_by:
          req.user?.id || null,
      }, { transaction:t });

    await t.commit();

    const full =
      await Message.findByPk(
        message.id,
        {
          include: MESSAGE_INCLUDES,
        }
      );

    await auditService.logAction({
      user:req.user,
      module:MODULE_KEY,
      action:"create",
      entityId:message.id,
      entity:full,
    });

    return success(
      res,
      "✅ Message sent",
      full
    );
  } catch (err) {
    await t.rollback();

    debug.error(
      "sendMessage → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to send message",
      err
    );
  }
};
/* ============================================================
   📌 GET ALL MESSAGES
============================================================ */
export const getAllMessages = async (
  req,
  res
) => {
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
    } = validatePaginationStrict(req,{
      limit:25,
      maxLimit:200,
    });

    const role =
      (
        req.user?.roleNames?.[0] ||
        "staff"
      ).toLowerCase();

    const visibleFields =
      FIELD_VISIBILITY_MESSAGE[
        role
      ] ||
      FIELD_VISIBILITY_MESSAGE.staff;

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
        req.user.facility_ids.length > 0
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
            content: {
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
       📌 CONVERSATION FILTER
    ======================================================== */
    if (req.query.conversation_id) {
      options.where[Op.and].push({
        conversation_id:
          req.query.conversation_id,
      });
    }

    /* ========================================================
       📌 MESSAGE TYPE
    ======================================================== */
    if (req.query.message_type) {
      options.where[Op.and].push({
        message_type:
          req.query.message_type,
      });
    }

    /* ========================================================
       📌 LOCKED FILTER
    ======================================================== */
    if (req.query.is_locked) {
      options.where[Op.and].push({
        "$conversation.is_locked$":
          req.query.is_locked === "true",
      });
    }

    /* ========================================================
       📌 DELIVERY FILTER
    ======================================================== */
    if (req.query.delivered) {
      options.where[Op.and].push({
        delivered_at: {
          [Op.ne]: null,
        },
      });
    }

    /* ========================================================
       📌 STATUS
    ======================================================== */
    if (req.query.status) {
      options.where[Op.and].push({
        status:req.query.status,
      });
    }

    const { count, rows } =
      await Message.findAndCountAll({
        where: options.where,

        include: MESSAGE_INCLUDES,

        order: options.order,

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
      "✅ Messages loaded",
      {
        records: rows,

        pagination: {
          total: count,
          page,
          pageCount: Math.ceil(
            count / limit
          ),
        },
      }
    );
  } catch (err) {
    debug.error(
      "getAllMessages → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to load messages",
      err
    );
  }
};

/* ============================================================
   📌 GET MESSAGE BY ID
============================================================ */
export const getMessageById = async (
  req,
  res
) => {
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
      await Message.findByPk(
        req.params.id,
        {
          include: MESSAGE_INCLUDES,
        }
      );

    if (!record) {
      return error(
        res,
        "Message not found",
        null,
        404
      );
    }

    return success(
      res,
      "✅ Message loaded",
      record
    );
  } catch (err) {
    debug.error(
      "getMessageById → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to load message",
      err
    );
  }
};

/* ============================================================
   📌 DELETE MESSAGE
============================================================ */
export const deleteMessage = async (
  req,
  res
) => {
  const t = await sequelize.transaction();

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
      await Message.findByPk(
        req.params.id,
        {
          transaction:t,
        }
      );

    if (!record) {
      await t.rollback();

      return error(
        res,
        "Message not found",
        null,
        404
      );
    }

    await messagingService.deleteMessage(
      record.id
    );

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
      "✅ Message deleted"
    );
  } catch (err) {
    await t.rollback();

    debug.error(
      "deleteMessage → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to delete message",
      err
    );
  }
};