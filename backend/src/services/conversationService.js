// 📁 backend/src/services/conversationService.js

import db from "../models/index.js";

const {
  Conversation,
  ConversationParticipant,
} = db;

const conversationService = {
  /* ============================================================
     ➕ CREATE CONVERSATION
  ============================================================ */
  async createConversation(
    payload,
    options = {}
  ) {
    const {
      participant_ids = [],
      participant_role,

      created_by,

      ...conversationData
    } = payload;

    const conversation =
      await Conversation.create(
        {
          ...conversationData,

          created_by,
        },
        options
      );

    /* ========================================================
       👥 PARTICIPANTS
    ======================================================== */
    for (const participant_id of participant_ids) {
      await ConversationParticipant.create(
        {
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

          created_by,
        },
        options
      );
    }

    return conversation;
  },
};

export default conversationService;