// 📁 backend/src/controllers/supportTicketController.js
// ============================================================================
// 🎫 Support Ticket Controller – Enterprise Master Pattern
// ----------------------------------------------------------------------------
// 🔹 Full tenant-safe support controller
// 🔹 Ticket lifecycle management
// 🔹 Audit-safe architecture
// 🔹 Dynamic filtering + pagination
// 🔹 Role-safe access enforcement
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";

import {
  sequelize,

  SupportTicket,
  TicketActivity,

  Conversation,

  Organization,
  Facility,

  Employee,
  Patient,

  User,
} from "../models/index.js";

import {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_PRIORITY,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_SUPPORT_TICKET } from "../constants/fieldVisibility.js";

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

import supportTicketService from "../services/supportTicketService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "support_tickets";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;

const debug = makeModuleLogger(
  "supportTicketController",
  DEBUG_OVERRIDE
);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const TICKET_INCLUDES = [
  {
    model: Conversation,
    as: "conversation",
  },

  {
    model: TicketActivity,
    as: "activities",
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
    model: Patient,
    as: "patient",
    attributes: [
      "id",
      "pat_no",
      "first_name",
      "last_name",
    ],
    required: false,
  },

  {
    model: Employee,
    as: "employee",
    attributes: [
      "id",
      "first_name",
      "last_name",
    ],
    required: false,
  },

  {
    model: Employee,
    as: "assignedEmployee",
    attributes: [
      "id",
      "first_name",
      "last_name",
    ],
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
   📋 VALIDATION SCHEMA
============================================================ */
function buildTicketSchema(
  mode = "create"
) {
  const base = {
    patient_id: Joi.string()
      .uuid()
      .allow(null),

    employee_id: Joi.string()
      .uuid()
      .allow(null),

    assigned_to: Joi.string()
      .uuid()
      .allow(null),

    subject: Joi.string()
      .max(255)
      .required(),

    description: Joi.string()
      .required(),

    category: Joi.string()
      .required(),

    priority: Joi.string()
      .valid(
        ...Object.values(
          SUPPORT_TICKET_PRIORITY
        )
      )
      .default(
        SUPPORT_TICKET_PRIORITY.MEDIUM
      ),

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
   📌 CREATE TICKET
============================================================ */
export const createTicket = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user: req.user,
        module: MODULE_KEY,
        action: "create",
        res,
      });

    if (!allowed) return;

    const { value, errors } =
      validate(
        buildTicketSchema("create"),
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
        user: req.user,
        value,
        body: req.body,
      });

    const record =
      await supportTicketService.createTicket(
        {
          ...value,

          organization_id: orgId,
          facility_id: facilityId,

          created_by:
            req.user?.id || null,
        }
      );

    const full =
      await SupportTicket.findByPk(
        record.id,
        {
          include: TICKET_INCLUDES,
        }
      );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: record.id,
      entity: full,
    });

    return success(
      res,
      "✅ Support ticket created",
      full
    );
  } catch (err) {
    debug.error(
      "createTicket → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to create ticket",
      err
    );
  }
};

/* ============================================================
   📌 GET ALL TICKETS
============================================================ */
export const getAllTickets = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user: req.user,
        module: MODULE_KEY,
        action: "read",
        res,
      });

    if (!allowed) return;

    const {
      limit,
      page,
      offset,
    } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role =
      (
        req.user?.roleNames?.[0] ||
        "staff"
      ).toLowerCase();

    const visibleFields =
      FIELD_VISIBILITY_SUPPORT_TICKET[
        role
      ] ||
      FIELD_VISIBILITY_SUPPORT_TICKET.staff;

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
            { facility_id: null },
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
            subject: {
              [Op.iLike]:
                `%${options.search}%`,
            },
          },

          {
            description: {
              [Op.iLike]:
                `%${options.search}%`,
            },
          },

          {
            ticket_number: {
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
      const { start, end } =
        normalizeDateRangeLocal(
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
        status: req.query.status,
      });
    }

    /* ========================================================
       📌 PRIORITY
    ======================================================== */
    if (req.query.priority) {
      options.where[Op.and].push({
        priority:
          req.query.priority,
      });
    }

    const { count, rows } =
      await SupportTicket.findAndCountAll({
        where: options.where,

        include: TICKET_INCLUDES,

        order: options.order,

        offset,
        limit,

        distinct: true,
      });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
      },
    });

    return success(
      res,
      "✅ Support tickets loaded",
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
      "getAllTickets → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to load tickets",
      err
    );
  }
};

/* ============================================================
   📌 GET TICKET BY ID
============================================================ */
export const getTicketById = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user: req.user,
        module: MODULE_KEY,
        action: "read",
        res,
      });

    if (!allowed) return;

    const record =
      await SupportTicket.findByPk(
        req.params.id,
        {
          include: TICKET_INCLUDES,
        }
      );

    if (!record) {
      return error(
        res,
        "Support ticket not found",
        null,
        404
      );
    }

    return success(
      res,
      "✅ Support ticket loaded",
      record
    );
  } catch (err) {
    debug.error(
      "getTicketById → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to load ticket",
      err
    );
  }
};

/* ============================================================
   📌 ASSIGN TICKET
============================================================ */
export const assignTicket = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user: req.user,
        module: MODULE_KEY,
        action: "assign",
        res,
      });

    if (!allowed) return;

    const record =
      await supportTicketService.assignTicket(
        {
          ticket_id: req.params.id,

          assigned_to:
            req.body.assigned_to,

          performed_by:
            req.user?.employee_id,
        }
      );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "assign",
      entityId: record.id,
      entity: record,
    });

    return success(
      res,
      "✅ Ticket assigned",
      record
    );
  } catch (err) {
    debug.error(
      "assignTicket → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to assign ticket",
      err
    );
  }
};

/* ============================================================
   📌 RESOLVE TICKET
============================================================ */
export const resolveTicket = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user: req.user,
        module: MODULE_KEY,
        action: "resolve",
        res,
      });

    if (!allowed) return;

    const record =
      await supportTicketService.resolveTicket(
        {
          ticket_id: req.params.id,

          performed_by:
            req.user?.employee_id,
        }
      );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "resolve",
      entityId: record.id,
      entity: record,
    });

    return success(
      res,
      "✅ Ticket resolved",
      record
    );
  } catch (err) {
    debug.error(
      "resolveTicket → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to resolve ticket",
      err
    );
  }
};

/* ============================================================
   📌 CLOSE TICKET
============================================================ */
export const closeTicket = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user: req.user,
        module: MODULE_KEY,
        action: "close",
        res,
      });

    if (!allowed) return;

    const record =
      await supportTicketService.closeTicket(
        {
          ticket_id: req.params.id,

          performed_by:
            req.user?.employee_id,
        }
      );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "close",
      entityId: record.id,
      entity: record,
    });

    return success(
      res,
      "✅ Ticket closed",
      record
    );
  } catch (err) {
    debug.error(
      "closeTicket → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to close ticket",
      err
    );
  }
};

/* ============================================================
   📌 REOPEN TICKET
============================================================ */
export const reopenTicket = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user:req.user,
        module:MODULE_KEY,
        action:"reopen",
        res,
      });

    if (!allowed) return;

    const record =
      await supportTicketService.reopenTicket({
        ticket_id:req.params.id,

        performed_by:
          req.user?.employee_id,
      });

    await auditService.logAction({
      user:req.user,
      module:MODULE_KEY,
      action:"reopen",
      entityId:record.id,
      entity:record,
    });

    return success(
      res,
      "✅ Ticket reopened",
      record
    );
  } catch (err) {
    debug.error(
      "reopenTicket → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to reopen ticket",
      err
    );
  }
};

/* ============================================================
   📌 ESCALATE TICKET
============================================================ */
export const escalateTicket = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user:req.user,
        module:MODULE_KEY,
        action:"escalate",
        res,
      });

    if (!allowed) return;

    const record =
      await supportTicketService.escalateTicket({
        ticket_id:req.params.id,

        performed_by:
          req.user?.employee_id,
      });

    await auditService.logAction({
      user:req.user,
      module:MODULE_KEY,
      action:"escalate",
      entityId:record.id,
      entity:record,
    });

    return success(
      res,
      "✅ Ticket escalated",
      record
    );
  } catch (err) {
    debug.error(
      "escalateTicket → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to escalate ticket",
      err
    );
  }
};

/* ============================================================
   📌 ADD INTERNAL NOTE
============================================================ */
export const addInternalNote = async (
  req,
  res
) => {
  try {
    const allowed =
      await authzService.checkPermission({
        user:req.user,
        module:MODULE_KEY,
        action:"update",
        res,
      });

    if (!allowed) return;

    if (!req.body.note) {
      return error(
        res,
        "Internal note is required",
        null,
        400
      );
    }

    await supportTicketService.addInternalNote({
      ticket_id:req.params.id,

      note:req.body.note,

      performed_by:
        req.user?.employee_id,
    });

    await auditService.logAction({
      user:req.user,
      module:MODULE_KEY,
      action:"note",
      entityId:req.params.id,
      details:{
        note:req.body.note,
      },
    });

    return success(
      res,
      "✅ Internal note added"
    );
  } catch (err) {
    debug.error(
      "addInternalNote → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to add note",
      err
    );
  }
};

/* ============================================================
   📌 GET TICKET ACTIVITIES
============================================================ */
export const getTicketActivities =
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

      const records =
        await supportTicketService.getTicketActivities(
          req.params.id
        );

      return success(
        res,
        "✅ Ticket activities loaded",
        records
      );
    } catch (err) {
      debug.error(
        "getTicketActivities → FAILED",
        err
      );

      return error(
        res,
        "❌ Failed to load activities",
        err
      );
    }
  };

/* ============================================================
   📌 DELETE TICKET
============================================================ */
export const deleteTicket = async (
  req,
  res
) => {
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
      await SupportTicket.findByPk(
        req.params.id,
        {
          transaction:t,
        }
      );

    if (!record) {
      await t.rollback();

      return error(
        res,
        "Support ticket not found",
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
      "✅ Support ticket deleted"
    );
  } catch (err) {
    await t.rollback();

    debug.error(
      "deleteTicket → FAILED",
      err
    );

    return error(
      res,
      "❌ Failed to delete ticket",
      err
    );
  }
};