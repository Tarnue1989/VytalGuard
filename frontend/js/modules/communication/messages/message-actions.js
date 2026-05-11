// 📁 frontend/js/modules/communication/messages/message-actions.js
// ============================================================================
// 💬 Message Actions – Enterprise MASTER Engine
// ----------------------------------------------------------------------------
// ✅ Realtime chat
// ✅ Attachments
// ✅ Typing indicators
// ✅ Read receipts
// ✅ Delivery receipts
// ✅ Socket listeners
// ✅ Enterprise permission handling
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  showConfirm,
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";

import {
  SOCKET_EVENTS,
  MESSAGE_UPLOAD,
} from "./message-constants.js";

import {
  appendMessageBubble,
  renderTypingIndicator,
  removeTypingIndicator,
  markMessageReadUI,
  renderAttachmentPreview,
  markMessageDeliveredUI,
  markConversationLockedUI,
} from "./message-render.js";

let _socket = null;
let _conversationId = null;
let _user = null;

/* ============================================================
   🚀 SETUP MESSAGE ACTIONS
============================================================ */
export function setupMessageActions({
  socket,
  user,
  conversationId,
}) {
  _socket = socket;
  _conversationId = conversationId;
  _user = user;

  bindSendMessage();
  bindTyping();
  bindAttachmentPreview();

  setupSocketListeners();
}

/* ============================================================
   📩 SEND MESSAGE
============================================================ */
function bindSendMessage() {
  const form =
    document.getElementById(
      "messageForm"
    );

  if (!form || form.dataset.bound)
    return;

  form.dataset.bound = "true";

  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();

      await handleSendMessage();
    }
  );
}

async function handleSendMessage() {
  const input =
    document.getElementById(
      "messageInput"
    );

  const attachmentInput =
    document.getElementById(
      "messageAttachment"
    );

  const content =
    input?.value?.trim() || "";

  const files =
    attachmentInput?.files || [];

  if (
    !content &&
    !files.length
  ) {
    return showToast(
      "⚠️ Message cannot be empty"
    );
  }

  try {
    showLoading();

    const formData =
      new FormData();

    formData.append(
      "conversation_id",
      _conversationId
    );

    formData.append(
      "content",
      content
    );

    formData.append(
      "source",
      "web"
    );

    formData.append(
      "device",
      navigator.userAgent
    );

    formData.append(
      "message_type",
      files.length
        ? "document"
        : "text"
    );

    /* ========================================================
       📎 ATTACHMENTS
    ======================================================== */
    Array.from(files).forEach(
      (file) => {
        formData.append(
          "message_attachment",
          file
        );
      }
    );

    const res =
      await authFetch(
        "/api/messages",
        {
          method:"POST",
          body:formData,
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      throw new Error(
        data.message ||
          "❌ Failed to send message"
      );
    }

    const message =
      data?.data;

    /* ========================================================
       ⚡ REALTIME EMIT
    ======================================================== */
    _socket.emit(
      SOCKET_EVENTS.NEW_MESSAGE,
      {
        conversation_id:
          _conversationId,

        message,
      }
    );

    appendMessageBubble(
      message,
      _user
    );

    input.value = "";

    if (attachmentInput) {
      attachmentInput.value = "";
    }

    clearAttachmentPreview();

  } catch (err) {
    showToast(
      err.message ||
        "❌ Failed to send message"
    );
  } finally {
    hideLoading();
  }
}

/* ============================================================
   ✍️ TYPING
============================================================ */
function bindTyping() {
  const input =
    document.getElementById(
      "messageInput"
    );

  if (!input) return;

  let typingTimeout;

  input.addEventListener(
    "input",
    () => {
      _socket.emit(
        SOCKET_EVENTS.TYPING,
        {
          conversation_id:
            _conversationId,

          user_id:
            _user?.id,
        }
      );

      clearTimeout(
        typingTimeout
      );

      typingTimeout =
        setTimeout(() => {
          _socket.emit(
            SOCKET_EVENTS.STOP_TYPING,
            {
              conversation_id:
                _conversationId,

              user_id:
                _user?.id,
            }
          );
        }, 1200);
    }
  );
}

/* ============================================================
   📎 ATTACHMENT PREVIEW
============================================================ */
function bindAttachmentPreview() {
  const input =
    document.getElementById(
      "messageAttachment"
    );

  if (!input) return;

  input.addEventListener(
    "change",
    () => {
      const files =
        Array.from(
          input.files || []
        );

      if (
        files.length >
        MESSAGE_UPLOAD.maxFiles
      ) {
        showToast(
          `⚠️ Max ${MESSAGE_UPLOAD.maxFiles} files allowed`
        );

        input.value = "";

        return;
      }

      renderAttachmentPreview(
        files
      );
    }
  );
}

function clearAttachmentPreview() {
  const container =
    document.getElementById(
      "attachmentPreview"
    );

  if (container) {
    container.innerHTML = "";
  }
}

/* ============================================================
   ⚡ SOCKET LISTENERS
============================================================ */
function setupSocketListeners() {
  if (!_socket) return;

  /* ========================================================
     📩 NEW MESSAGE
  ======================================================== */
  _socket.off(
    SOCKET_EVENTS.NEW_MESSAGE
  );

  _socket.on(
    SOCKET_EVENTS.NEW_MESSAGE,
    ({ message }) => {
      appendMessageBubble(
        message,
        _user
      );

      markMessageDelivered(
        message?.id
      );
    }
  );

  /* ========================================================
     ✍️ TYPING
  ======================================================== */
  _socket.off(
    SOCKET_EVENTS.TYPING
  );

  _socket.on(
    SOCKET_EVENTS.TYPING,
    ({ user_id }) => {
      if (
        String(user_id) ===
        String(_user?.id)
      )
        return;

      renderTypingIndicator(
        user_id
      );
    }
  );

  /* ========================================================
     ✍️ STOP TYPING
  ======================================================== */
  _socket.off(
    SOCKET_EVENTS.STOP_TYPING
  );

  _socket.on(
    SOCKET_EVENTS.STOP_TYPING,
    ({ user_id }) => {
      removeTypingIndicator(
        user_id
      );
    }
  );

  /* ========================================================
     ✅ DELIVERY RECEIPT
  ======================================================== */
  _socket.off(
    SOCKET_EVENTS.MESSAGE_DELIVERED
  );

  _socket.on(
    SOCKET_EVENTS.MESSAGE_DELIVERED,
    ({
      message_id,
      user_id,
    }) => {
      markMessageDeliveredUI(
        message_id,
        user_id
      );
    }
  );

  /* ========================================================
     ✅ READ RECEIPT
  ======================================================== */
  _socket.off(
    SOCKET_EVENTS.MESSAGE_READ
  );

  _socket.on(
    SOCKET_EVENTS.MESSAGE_READ,
    ({
      message_id,
      user_id,
    }) => {
      markMessageReadUI(
        message_id,
        user_id
      );
    }
  );

  /* ========================================================
     🔒 CONVERSATION LOCKED
  ======================================================== */
  _socket.off(
    SOCKET_EVENTS.CONVERSATION_LOCKED
  );

  _socket.on(
    SOCKET_EVENTS.CONVERSATION_LOCKED,
    () => {
      markConversationLockedUI();
    }
  );
}

/* ============================================================
   ✅ MARK MESSAGE DELIVERED
============================================================ */
export function markMessageDelivered(
  messageId
) {
  if (
    !_socket ||
    !messageId
  )
    return;

  _socket.emit(
    SOCKET_EVENTS.MESSAGE_DELIVERED,
    {
      conversation_id:
        _conversationId,

      message_id:
        messageId,

      user_id:
        _user?.id,
    }
  );
}

/* ============================================================
   ✅ MARK MESSAGE READ
============================================================ */
export function markMessageRead(
  messageId
) {
  if (
    !_socket ||
    !messageId
  )
    return;

  _socket.emit(
    SOCKET_EVENTS.MESSAGE_READ,
    {
      conversation_id:
        _conversationId,

      message_id:
        messageId,

      user_id:
        _user?.id,
    }
  );
}

/* ============================================================
   🚪 JOIN CONVERSATION
============================================================ */
export function joinConversation(
  conversationId
) {
  if (!_socket) return;

  _conversationId =
    conversationId;

  _socket.emit(
    SOCKET_EVENTS.JOIN,
    conversationId
  );
}

/* ============================================================
   🚪 LEAVE CONVERSATION
============================================================ */
export function leaveConversation(
  conversationId
) {
  if (!_socket) return;

  _socket.emit(
    SOCKET_EVENTS.LEAVE,
    conversationId
  );
}

/* ============================================================
   🗑️ DELETE MESSAGE
============================================================ */
export async function deleteMessage(
  id
) {
  const confirmed =
    await showConfirm(
      "Delete this message?"
    );

  if (!confirmed) return;

  try {
    showLoading();

    const res =
      await authFetch(
        `/api/messages/${id}`,
        {
          method:"DELETE",
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      throw new Error(
        data.message ||
          "❌ Failed"
      );
    }

    document
      .querySelector(
        `[data-message-id="${id}"]`
      )
      ?.remove();

    showToast(
      "✅ Message deleted"
    );

  } catch (err) {
    showToast(
      err.message ||
        "❌ Failed"
    );
  } finally {
    hideLoading();
  }
}