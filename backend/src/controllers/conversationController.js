// 📁 backend/src/controllers/conversationController.js
import Joi from "joi";
import { Op } from "sequelize";

import {
  sequelize,
  Conversation,
  ConversationParticipant,
  Organization,
  Facility,
  Employee,
  Patient,
} from "../models/index.js";

import {
  CONVERSATION_STATUS,
  CONVERSATION_TYPES,
} from "../constants/enums.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import conversationService from "../services/conversationService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "conversations";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = false;

const debug = makeModuleLogger(
  "conversationController",
  DEBUG_OVERRIDE
);

/* ============================================================
   🔗 INCLUDES
============================================================ */
const CONVERSATION_INCLUDES = [
  {
    model:Organization,
    as:"organization",
    attributes:["id","name","code"],
  },

  {
    model:Facility,
    as:"facility",
    attributes:["id","name","code"],
    required:false,
  },

  {
    model:ConversationParticipant,
    as:"participants",

    include:[
      {
        model:Employee,
        as:"employeeParticipant",
        attributes:[
          "id",
          "first_name",
          "last_name",
        ],
        required:false,
      },

      {
        model:Patient,
        as:"patientParticipant",
        attributes:[
          "id",
          "first_name",
          "last_name",
        ],
        required:false,
      },
    ],
  },
];

/* ============================================================
   📋 VALIDATION
============================================================ */
function buildConversationSchema(
  mode = "create"
) {
  const base = {
    topic:Joi.string()
      .allow(null, ""),

    conversation_type:Joi.string()
      .valid(
        ...Object.values(
          CONVERSATION_TYPES
        )
      )
      .required(),

    participant_ids:
      Joi.array()
        .items(
          Joi.string().uuid()
        )
        .min(1)
        .required(),

    participant_role:
      Joi.string()
        .required(),

    allow_attachments:
      Joi.boolean()
        .default(true),

    organization_id:
      Joi.forbidden(),

    facility_id:
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
   📌 CREATE CONVERSATION
============================================================ */
export const createConversation =
  async (req, res) => {
    const t =
      await sequelize.transaction();

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
          buildConversationSchema(
            "create"
          ),
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

      const {
        orgId,
        facilityId,
      } =
        resolveOrgFacility({
          user:req.user,
          value,
          body:req.body,
        });

      const record =
        await conversationService.createConversation({
          ...value,

          organization_id:
            orgId,

          facility_id:
            facilityId,

          created_by:
            req.user?.id,
        }, {
          transaction:t,
        });

      await t.commit();

      const full =
        await Conversation.findByPk(
          record.id,
          {
            include:
              CONVERSATION_INCLUDES,
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
        "✅ Conversation created",
        full
      );
    } catch (err) {
      await t.rollback();

      debug.error(
        "createConversation → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to create conversation",
        err
      );
    }
  };

  /* ============================================================
   📋 GET ALL CONVERSATIONS
============================================================ */
export const getAllConversations =
  async (req, res) => {
    try {
      const allowed =
        await authzService.checkPermission({
          user:req.user,
          module:MODULE_KEY,
          action:"view",
          res,
        });

      if (!allowed) return;

      const {
        page,
        limit,
        offset,
      } =
        validatePaginationStrict(
          req.query
        );

      const {
        search,
        conversation_type,
        status,
      } = req.query;

      const where = {};

      if (!req.user?.is_superadmin) {
        where.organization_id =
          req.user.organization_id;

        if (
          req.user.facility_id
        ) {
          where.facility_id =
            req.user.facility_id;
        }
      }

      if (conversation_type) {
        where.conversation_type =
          conversation_type;
      }

      if (status) {
        where.status = status;
      }

      if (search) {
        where[Op.or] = [
          {
            topic:{
              [Op.iLike]:
                `%${search}%`,
            },
          },
        ];
      }

      const query =
        buildQueryOptions({
          page,
          limit,
          sortBy:
            req.query.sortBy ||
            "updated_at",

          sortOrder:
            req.query.sortOrder ||
            "DESC",
        });

      const records =
        await Conversation.findAndCountAll({
          where,

          include:
            CONVERSATION_INCLUDES,

          distinct:true,

          ...query,
        });

      return success(
        res,
        "✅ Conversations loaded",
        {
          records:
            records.rows,

          pagination:{
            total:
              records.count,

            page,

            pageCount:
              Math.ceil(
                records.count /
                limit
              ),
          },
        }
      );
    } catch (err) {
      debug.error(
        "getAllConversations → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to load conversations",
        err
      );
    }
  };

/* ============================================================
   🔍 GET SINGLE CONVERSATION
============================================================ */
export const getConversationById =
  async (req, res) => {
    try {
      const allowed =
        await authzService.checkPermission({
          user:req.user,
          module:MODULE_KEY,
          action:"view",
          res,
        });

      if (!allowed) return;

      const record =
        await Conversation.findByPk(
          req.params.id,
          {
            include:
              CONVERSATION_INCLUDES,
          }
        );

      if (!record) {
        return error(
          res,
          "Conversation not found",
          null,
          404
        );
      }

      return success(
        res,
        "✅ Conversation loaded",
        record
      );
    } catch (err) {
      debug.error(
        "getConversationById → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to load conversation",
        err
      );
    }
  };

/* ============================================================
   📦 ARCHIVE CONVERSATION
============================================================ */
export const archiveConversation =
  async (req, res) => {
    try {
      const record =
        await Conversation.findByPk(
          req.params.id
        );

      if (!record) {
        return error(
          res,
          "Conversation not found",
          null,
          404
        );
      }

      await record.update({
        is_archived:true,
        updated_by:req.user.id,
      });

      return success(
        res,
        "✅ Conversation archived",
        record
      );
    } catch (err) {
      debug.error(
        "archiveConversation → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to archive conversation",
        err
      );
    }
  };

/* ============================================================
   🔒 LOCK CONVERSATION
============================================================ */
export const lockConversation =
  async (req, res) => {
    try {
      const record =
        await Conversation.findByPk(
          req.params.id
        );

      if (!record) {
        return error(
          res,
          "Conversation not found",
          null,
          404
        );
      }

      await record.update({
        is_locked:true,
        updated_by:req.user.id,
      });

      return success(
        res,
        "✅ Conversation locked",
        record
      );
    } catch (err) {
      debug.error(
        "lockConversation → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to lock conversation",
        err
      );
    }
  };

/* ============================================================
   ➕ ADD PARTICIPANT
============================================================ */
export const addParticipant =
  async (req, res) => {
    const t =
      await sequelize.transaction();

    try {
      const {
        participant_id,
        participant_role,
      } = req.body;

      const conversation =
        await Conversation.findByPk(
          req.params.id
        );

      if (!conversation) {
        await t.rollback();

        return error(
          res,
          "Conversation not found",
          null,
          404
        );
      }

      const exists =
        await ConversationParticipant.findOne({
          where:{
            conversation_id:
              conversation.id,

            participant_id,

            participant_role,
          },
        });

      if (exists) {
        await t.rollback();

        return error(
          res,
          "Participant already exists",
          null,
          409
        );
      }

      const participant =
        await ConversationParticipant.create({
          organization_id:
            conversation.organization_id,

          facility_id:
            conversation.facility_id,

          conversation_id:
            conversation.id,

          participant_id,

          participant_role,

          joined_at:
            new Date(),

          created_by:
            req.user.id,
        }, {
          transaction:t,
        });

      await t.commit();

      return success(
        res,
        "✅ Participant added",
        participant
      );
    } catch (err) {
      await t.rollback();

      debug.error(
        "addParticipant → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to add participant",
        err
      );
    }
  };

/* ============================================================
   ➖ REMOVE PARTICIPANT
============================================================ */
export const removeParticipant =
  async (req, res) => {
    try {
      const participant =
        await ConversationParticipant.findOne({
          where:{
            conversation_id:
              req.params.id,

            participant_id:
              req.body.participant_id,
          },
        });

      if (!participant) {
        return error(
          res,
          "Participant not found",
          null,
          404
        );
      }

      await participant.update({
        left_at:new Date(),
        updated_by:req.user.id,
      });

      await participant.destroy();

      return success(
        res,
        "✅ Participant removed"
      );
    } catch (err) {
      debug.error(
        "removeParticipant → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to remove participant",
        err
      );
    }
  };

/* ============================================================
   🗑️ DELETE CONVERSATION
============================================================ */
export const deleteConversation =
  async (req, res) => {
    try {
      const record =
        await Conversation.findByPk(
          req.params.id
        );

      if (!record) {
        return error(
          res,
          "Conversation not found",
          null,
          404
        );
      }

      await record.update({
        deleted_by:req.user.id,
      });

      await record.destroy();

      return success(
        res,
        "✅ Conversation deleted"
      );
    } catch (err) {
      debug.error(
        "deleteConversation → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to delete conversation",
        err
      );
    }
  };