// 📁 backend/src/services/supportTicketService.js

import db from "../models/index.js";

import {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_PRIORITY,
  TICKET_ACTIVITY_TYPES,
  CONVERSATION_TYPES,
  NOTIFICATION_TYPES,
} from "../constants/enums.js";

import messagingService from "./messagingService.js";
import notificationService from "./notificationService.js";

const {
  sequelize,

  SupportTicket,
  TicketActivity,

  Conversation,
} = db;

/* =========================================================
   Helpers
========================================================= */

const buildTicketMetadata = ({
  source = "support-service",
  sla = false,
} = {}) => ({
  source,
  sla,
});

/* =========================================================
   Support Ticket Service
========================================================= */

class SupportTicketService {
  /* =====================================================
     Generate Ticket Number
  ===================================================== */
  async generateTicketNumber() {
    const count =
      await SupportTicket.count();

    const next =
      String(count + 1).padStart(6, "0");

    return `TKT-${next}`;
  }

  /* =====================================================
     Create Ticket
  ===================================================== */
  async createTicket(payload = {}) {
    const transaction =
      await sequelize.transaction();

    try {
      const {
        organization_id,
        facility_id,

        patient_id,
        employee_id,

        assigned_to,

        subject,
        description,

        priority =
          SUPPORT_TICKET_PRIORITY.MEDIUM,

        category,

        created_by,
      } = payload;

      /* ===============================================
         Create Conversation
      =============================================== */

      const participants = [];

      if (employee_id) {
        participants.push({
          participant_id: employee_id,
          participant_role: "employee",
          is_admin: true,
        });
      }

      if (patient_id) {
        participants.push({
          participant_id: patient_id,
          participant_role: "patient",
        });
      }

      if (assigned_to) {
        participants.push({
          participant_id: assigned_to,
          participant_role: "employee",
          is_admin: true,
        });
      }

      const conversation =
        await messagingService.createConversation({
          organization_id,
          facility_id,

          patient_id,
          employee_id,

          topic: subject,

          conversation_type:
            CONVERSATION_TYPES.HELPDESK,

          participants,

          created_by,
        }, { transaction });

      /* ===============================================
         Create Ticket
      =============================================== */

      const ticket_number =
        await this.generateTicketNumber();

      const ticket =
        await SupportTicket.create({
          organization_id,
          facility_id,

          conversation_id:
            conversation.id,

          patient_id,
          employee_id,

          assigned_to,

          ticket_number,

          subject,
          description,

          priority,
          category,

          status:
            SUPPORT_TICKET_STATUS.OPEN,

          opened_at: new Date(),

          due_at: payload.due_at,

          sla_breached: false,

          reopened_count: 0,

          metadata:
            buildTicketMetadata(),

          created_by,
        }, { transaction });

      /* ===============================================
         Create Initial Activity
      =============================================== */

      await TicketActivity.create({
        organization_id,
        facility_id,

        ticket_id: ticket.id,

        activity_type:
          TICKET_ACTIVITY_TYPES.CREATED,

        notes:
          "Support ticket created",

        activity_source:
          "support-service",

        metadata: {},

        performed_by: employee_id,

        created_by,
      }, { transaction });

      /* ===============================================
         Notify Assigned Staff
      =============================================== */

      if (assigned_to) {
        await notificationService.createNotification({
          organization_id,
          facility_id,

          user_id: assigned_to,

          title:
            "New Support Ticket",

          message: `${ticket.subject}`,

          type:
            NOTIFICATION_TYPES.TICKET,

          reference_type:
            "support_ticket",

          reference_id: ticket.id,

          channel: "system",

          delivery_status:
            "pending",

          metadata: {},

          created_by,
        });
      }

      await transaction.commit();

      return ticket;
    } catch (error) {
      await transaction.rollback();

      throw error;
    }
  }

  /* =====================================================
     Assign Ticket
  ===================================================== */
  async assignTicket(payload = {}) {
    const {
      ticket_id,

      assigned_to,

      performed_by,
    } = payload;

    const ticket =
      await SupportTicket.findByPk(
        ticket_id
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    await ticket.update({
      assigned_to,
    });

    await TicketActivity.create({
      organization_id:
        ticket.organization_id,

      facility_id:
        ticket.facility_id,

      ticket_id: ticket.id,

      activity_type:
        TICKET_ACTIVITY_TYPES.ASSIGNED,

      notes:
        "Ticket assigned",

      activity_source:
        "support-service",

      metadata: {},

      performed_by,
    });

    return ticket;
  }

  /* =====================================================
     Escalate Ticket
  ===================================================== */
  async escalateTicket(payload = {}) {
    const {
      ticket_id,
      performed_by,
    } = payload;

    const ticket =
      await SupportTicket.findByPk(
        ticket_id
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    await ticket.update({
      is_escalated: true,
      escalated_at: new Date(),
    });

    await TicketActivity.create({
      organization_id:
        ticket.organization_id,

      facility_id:
        ticket.facility_id,

      ticket_id: ticket.id,

      activity_type:
        TICKET_ACTIVITY_TYPES.ESCALATED,

      notes:
        "Ticket escalated",

      activity_source:
        "support-service",

      metadata: {},

      performed_by,
    });

    return ticket;
  }

  /* =====================================================
     Resolve Ticket
  ===================================================== */
  async resolveTicket(payload = {}) {
    const {
      ticket_id,
      performed_by,
      resolution_summary,
    } = payload;

    const ticket =
      await SupportTicket.findByPk(
        ticket_id
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    await ticket.update({
      status:
        SUPPORT_TICKET_STATUS.RESOLVED,

      resolution_summary,

      resolved_at: new Date(),
    });

    await TicketActivity.create({
      organization_id:
        ticket.organization_id,

      facility_id:
        ticket.facility_id,

      ticket_id: ticket.id,

      activity_type:
        TICKET_ACTIVITY_TYPES.RESOLVED,

      notes:
        resolution_summary ||
        "Ticket resolved",

      activity_source:
        "support-service",

      metadata: {},

      performed_by,
    });

    return ticket;
  }

  /* =====================================================
     Close Ticket
  ===================================================== */
  async closeTicket(payload = {}) {
    const {
      ticket_id,
      performed_by,
    } = payload;

    const ticket =
      await SupportTicket.findByPk(
        ticket_id
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    await ticket.update({
      status:
        SUPPORT_TICKET_STATUS.CLOSED,

      closed_at: new Date(),

      closed_by: performed_by,
    });

    await TicketActivity.create({
      organization_id:
        ticket.organization_id,

      facility_id:
        ticket.facility_id,

      ticket_id: ticket.id,

      activity_type:
        TICKET_ACTIVITY_TYPES.CLOSED,

      notes:
        "Ticket closed",

      activity_source:
        "support-service",

      metadata: {},

      performed_by,
    });

    return ticket;
  }

  /* =====================================================
     Reopen Ticket
  ===================================================== */
  async reopenTicket(payload = {}) {
    const {
      ticket_id,
      performed_by,
    } = payload;

    const ticket =
      await SupportTicket.findByPk(
        ticket_id
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    await ticket.update({
      status:
        SUPPORT_TICKET_STATUS.OPEN,

      reopened_count:
        (ticket.reopened_count || 0) + 1,
    });

    await TicketActivity.create({
      organization_id:
        ticket.organization_id,

      facility_id:
        ticket.facility_id,

      ticket_id: ticket.id,

      activity_type:
        TICKET_ACTIVITY_TYPES.REOPENED,

      notes:
        "Ticket reopened",

      activity_source:
        "support-service",

      metadata: {},

      performed_by,
    });

    return ticket;
  }

  /* =====================================================
     Add Internal Note
  ===================================================== */
  async addInternalNote(payload = {}) {
    const {
      ticket_id,

      note,

      performed_by,
    } = payload;

    const ticket =
      await SupportTicket.findByPk(
        ticket_id
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    await TicketActivity.create({
      organization_id:
        ticket.organization_id,

      facility_id:
        ticket.facility_id,

      ticket_id: ticket.id,

      activity_type:
        TICKET_ACTIVITY_TYPES.NOTE_ADDED,

      notes: note,

      activity_source:
        "support-service",

      metadata: {},

      performed_by,
    });

    return true;
  }

  /* =====================================================
     Get Ticket Activities
  ===================================================== */
  async getTicketActivities(
    ticket_id
  ) {
    return TicketActivity.findAll({
      where: {
        ticket_id,
      },

      order: [
        ["created_at", "DESC"],
      ],
    });
  }

  /* =====================================================
     Get Ticket Details
  ===================================================== */
  async getTicket(ticket_id) {
    return SupportTicket.findByPk(
      ticket_id,
      {
        include: [
          {
            model: Conversation,
            as: "conversation",
          },

          {
            model: TicketActivity,
            as: "activities",
          },
        ],
      }
    );
  }
}

export default new SupportTicketService();