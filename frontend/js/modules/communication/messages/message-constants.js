// 📁 frontend/js/modules/communication/messages/message-constants.js
// ============================================================================
// 💬 Message Module Constants
// ----------------------------------------------------------------------------
// ✅ Enterprise MASTER parity
// ✅ Compact pattern
// ✅ Shared render/action/socket constants
// ============================================================================

/* ============================================================
   📌 FIELD ORDER
============================================================ */
export const FIELD_ORDER_MESSAGE = [
  "id",
  "conversation_id",

  "sender_id",
  "sender_role",

  "receiver_id",
  "receiver_role",

  "content",

  "message_type",
  "chat_type",

  "status",

  "is_read",
  "read_at",

  "delivered_at",

  "reply_to_message_id",

  "created_at",
  "updated_at",
];

/* ============================================================
   👁️ DEFAULT VISIBLE FIELDS
============================================================ */
export const FIELD_DEFAULTS_MESSAGE = {
  admin:FIELD_ORDER_MESSAGE,

  manager:[
    "sender_id",
    "receiver_id",
    "content",
    "message_type",
    "chat_type",
    "status",
    "is_read",
    "created_at",
  ],

  staff:[
    "sender_id",
    "content",
    "message_type",
    "status",
    "is_read",
    "created_at",
  ],
};

/* ============================================================
   💬 MESSAGE TYPES
============================================================ */
export const MESSAGE_TYPES = [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "system",
];

/* ============================================================
   👥 CHAT TYPES
============================================================ */
export const CHAT_TYPES = [
  "direct",
  "group",
  "support",
  "broadcast",
];

/* ============================================================
   📡 SOCKET EVENTS
============================================================ */
export const SOCKET_EVENTS = {
  REGISTER:"chat:register",

  JOIN:"chat:join-conversation",
  LEAVE:"chat:leave-conversation",

  NEW_MESSAGE:"chat:new-message",

  TYPING:"chat:typing",
  STOP_TYPING:"chat:stop-typing",

  MESSAGE_DELIVERED:
    "chat:message-delivered",

  MESSAGE_READ:
    "chat:message-read",

  CONVERSATION_LOCKED:
    "chat:conversation-locked",

  ONLINE_USERS:
    "chat:online-users",
};

/* ============================================================
   🎨 STATUS COLORS
============================================================ */
export const MESSAGE_STATUS_COLORS = {
  sent:"secondary",
  delivered:"info",
  read:"success",
  failed:"danger",
};

/* ============================================================
   📎 FILE TYPES
============================================================ */
export const MESSAGE_FILE_TYPES = {
  image:[
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ],

  video:[
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ],

  audio:[
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
  ],

  document:[
    "application/pdf",

    "application/msword",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    "application/vnd.ms-excel",

    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
};

/* ============================================================
   📦 UPLOAD
============================================================ */
export const MESSAGE_UPLOAD = {
  maxFiles:10,

  maxFileSize:
    100 * 1024 * 1024,

  accepted:
    ".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.mp4,.mp3,.wav",
};

/* ============================================================
   🔔 NOTIFICATION TYPES
============================================================ */
export const MESSAGE_NOTIFICATION_TYPES = [
  "message",
  "mention",
  "support",
  "broadcast",
];

/* ============================================================
   📏 UI LIMITS
============================================================ */
export const MESSAGE_UI_LIMITS = {
  sidebarPreviewLength:45,

  bubbleMaxWidth:"75%",

  typingDelay:1500,
};