// 📁 backend/src/services/messagingService.js

import { Op, literal } from "sequelize";
import db from "../models/index.js";

import {
  CONVERSATION_STATUS,
  MESSAGE_STATUS,
  MESSAGE_TYPES,
} from "../constants/enums.js";

const {
  sequelize,

  Conversation,
  ConversationParticipant,

  Message,
  MessageAttachment,

  Employee,
  Patient,

  Notification,
} = db;

/* =========================================================
   Helpers
========================================================= */

const normalizeParticipants = (participants = []) =>
  participants.map((p) => ({
    participant_id: p.participant_id,
    participant_role: p.participant_role,
  }));

const buildConversationParticipantRows = ({
  conversationId,
  organizationId,
  facilityId,
  participants = [],
  userId,
}) =>
  participants.map((p) => ({
    conversation_id: conversationId,
    organization_id: organizationId,
    facility_id: facilityId,
    participant_id: p.participant_id,
    participant_role: p.participant_role,
    is_admin: !!p.is_admin,
    unread_count: 0,
    notifications_enabled: true,
    joined_at: new Date(),
    metadata: {},
    created_by: userId,
  }));

const buildMessageMetadata = ({
  source = "web",
  device = null,
  forwarded = false,
} = {}) => ({
  source,
  device,
  forwarded,
});

/* =========================================================
   Messaging Service
========================================================= */

class MessagingService {
  /* =====================================================
     Create Conversation
  ===================================================== */
  async createConversation(payload = {}, options = {}) {
    const transaction =
      options.transaction ||
      (await sequelize.transaction());

    const useInternalTx = !options.transaction;

    try {
      const {
        organization_id,
        facility_id,

        patient_id,
        employee_id,

        topic,
        group_name,
        group_avatar,

        conversation_type,

        is_group = false,

        participants = [],

        created_by,
      } = payload;

      const conversation = await Conversation.create({
        organization_id,
        facility_id,

        patient_id,
        employee_id,

        topic,
        group_name,
        group_avatar,

        conversation_type,

        is_group,

        status: CONVERSATION_STATUS.ACTIVE,

        is_locked: false,
        allow_attachments: true,
        allow_replies: true,

        metadata: {
          source: "messaging-service",
        },

        created_by,
      }, { transaction });

      if (participants.length) {
        const rows =
          buildConversationParticipantRows({
            conversationId: conversation.id,
            organizationId: organization_id,
            facilityId: facility_id,
            participants,
            userId: created_by,
          });

        await ConversationParticipant.bulkCreate(
          rows,
          { transaction }
        );
      }

      if (useInternalTx) {
        await transaction.commit();
      }

      return conversation;
    } catch (error) {
      if (useInternalTx) {
        await transaction.rollback();
      }

      throw error;
    }
  }

  /* =====================================================
     Add Participant
  ===================================================== */
  async addParticipant(payload = {}) {
    const {
      conversation_id,

      organization_id,
      facility_id,

      participant_id,
      participant_role,

      is_admin = false,

      created_by,
    } = payload;

    const existing =
      await ConversationParticipant.findOne({
        where: {
          conversation_id,
          participant_id,
          participant_role,
        },
      });

    if (existing) {
      return existing;
    }

    return ConversationParticipant.create({
      conversation_id,

      organization_id,
      facility_id,

      participant_id,
      participant_role,

      is_admin,

      unread_count: 0,
      notifications_enabled: true,

      joined_at: new Date(),

      metadata: {},

      created_by,
    });
  }

  /* =====================================================
     Send Message
  ===================================================== */
  async sendMessage(payload = {}, options = {}) {
    const transaction =
      options.transaction ||
      (await sequelize.transaction());

    const useInternalTx = !options.transaction;

    try {
      const {
        organization_id,
        facility_id,

        conversation_id,

        sender_id,
        sender_role,

        receiver_id,
        receiver_role,

        content,

        message_type = MESSAGE_TYPES.TEXT,

        chat_type,

        reply_to_message_id,

        attachments = [],

        created_by,
      } = payload;

      const conversation =
        await Conversation.findByPk(
          conversation_id,
          { transaction }
        );

      if (!conversation) {
        throw new Error(
          "Conversation not found"
        );
      }

      if (conversation.is_locked) {
        throw new Error(
          "Conversation is locked"
        );
      }

      if (
        !conversation.allow_attachments &&
        attachments.length
      ) {
        throw new Error(
          "Attachments are disabled"
        );
      }

      const message = await Message.create({
        organization_id,
        facility_id,

        conversation_id,

        sender_id,
        sender_role,

        receiver_id,
        receiver_role,

        content,

        message_type,

        chat_type,

        status: MESSAGE_STATUS.SENT,

        reply_to_message_id,

        metadata: buildMessageMetadata({
          source: payload.source,
          device: payload.device,
        }),

        created_by,
      }, { transaction });

      /* ===============================================
         Attachments
      =============================================== */

      if (attachments.length) {
        const rows = attachments.map(
          (file) => ({
            organization_id,
            facility_id,

            message_id: message.id,

            file_name: file.file_name,
            original_file_name:
              file.original_file_name,

            file_type: file.file_type,
            mime_type: file.mime_type,

            file_size: file.file_size,

            file_path: file.file_path,
            file_url: file.file_url,

            thumbnail_path:
              file.thumbnail_path,

            storage_provider:
              file.storage_provider,

            storage_key: file.storage_key,

            checksum: file.checksum,

            expires_at:
              file.expires_at,

            is_encrypted:
              !!file.is_encrypted,

            metadata:
              file.metadata || {},

            created_by,
          })
        );

        await MessageAttachment.bulkCreate(
          rows,
          { transaction }
        );
      }

      /* ===============================================
         Update Conversation
      =============================================== */

      await conversation.update({
        last_message_id: message.id,
        last_message_at: new Date(),
      }, { transaction });

      /* ===============================================
         Update Unread Counts
      =============================================== */

      await ConversationParticipant.update({
        unread_count: literal(
          "unread_count + 1"
        ),
      }, {
        where: {
          conversation_id,
          participant_id: {
            [Op.ne]: sender_id,
          },
        },
        transaction,
      });

      if (useInternalTx) {
        await transaction.commit();
      }

      return await Message.findByPk(
        message.id,
        {
          include: [
            {
              model: MessageAttachment,
              as: "attachments",
            },
          ],
        }
      );
    } catch (error) {
      if (useInternalTx) {
        await transaction.rollback();
      }

      throw error;
    }
  }

  /* =====================================================
     Get Conversation Messages
  ===================================================== */
  async getConversationMessages({
    conversation_id,

    limit = 50,
    offset = 0,
  }) {
    return Message.findAndCountAll({
      where: {
        conversation_id,
      },

      include: [
        {
          model: MessageAttachment,
          as: "attachments",
        },
      ],

      order: [["created_at", "DESC"]],

      limit,
      offset,
    });
  }

  /* =====================================================
     Mark Message Read
  ===================================================== */
  async markMessageAsRead({
    message_id,

    participant_id,
  }) {
    const message =
      await Message.findByPk(message_id);

    if (!message) {
      throw new Error(
        "Message not found"
      );
    }

    await message.update({
      is_read: true,
      read_at: new Date(),
      delivered_at: new Date(),
      status: MESSAGE_STATUS.READ,
    });

    await ConversationParticipant.update({
      last_read_at: new Date(),
      last_read_message_id: message.id,
      unread_count: 0,
    }, {
      where: {
        conversation_id:
          message.conversation_id,

        participant_id,
      },
    });

    return message;
  }

  /* =====================================================
     Archive Conversation
  ===================================================== */
  async archiveConversation(
    conversation_id
  ) {
    const conversation =
      await Conversation.findByPk(
        conversation_id
      );

    if (!conversation) {
      throw new Error(
        "Conversation not found"
      );
    }

    await conversation.update({
      is_archived: true,
    });

    return conversation;
  }

  /* =====================================================
     Close Conversation
  ===================================================== */
  async closeConversation(
    conversation_id
  ) {
    const conversation =
      await Conversation.findByPk(
        conversation_id
      );

    if (!conversation) {
      throw new Error(
        "Conversation not found"
      );
    }

    await conversation.update({
      status:
        CONVERSATION_STATUS.CLOSED,

      closed_at: new Date(),
    });

    return conversation;
  }

  /* =====================================================
     Get User Conversations
  ===================================================== */
  async getParticipantConversations({
    participant_id,
  }) {
    return Conversation.findAll({
      include: [
        {
          model: ConversationParticipant,
          as: "participants",

          where: {
            participant_id,
          },

          required: true,
        },

        {
          model: Message,
          as: "lastMessage",
          required: false,
        },
      ],

      order: [["last_message_at", "DESC"]],
    });
  }

  /* =====================================================
     Delete Message
  ===================================================== */
  async deleteMessage(message_id) {
    const message =
      await Message.findByPk(message_id);

    if (!message) {
      throw new Error(
        "Message not found"
      );
    }

    await message.update({
      deleted_for_everyone: true,
    });

    return true;
  }
}

export default new MessagingService();