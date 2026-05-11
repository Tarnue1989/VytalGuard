// 📁 frontend/js/modules/communication/messages/message-render.js
// ============================================================================
// 💬 Message Render Engine
// ----------------------------------------------------------------------------
// ✅ Conversation rendering
// ✅ Message bubbles
// ✅ Typing indicators
// ✅ Attachment previews
// ✅ Read receipts
// ✅ Delivery receipts
// ✅ Compact enterprise UI
// ============================================================================

import {
  MESSAGE_STATUS_COLORS,
} from "./message-constants.js";

/* ============================================================
   📩 APPEND MESSAGE BUBBLE
============================================================ */
export function appendMessageBubble(
  message,
  currentUser
) {
  const container =
    document.getElementById(
      "chatMessages"
    );

  if (!container || !message)
    return;

  const isMine =
    String(message.sender_id) ===
    String(currentUser?.id);

  const wrapper =
    document.createElement("div");

  wrapper.className =
    `d-flex mb-2 ${
      isMine
        ? "justify-content-end"
        : "justify-content-start"
    }`;

  wrapper.dataset.messageId =
    message.id;

  wrapper.innerHTML = `
    <div
      class="
        chat-bubble
        ${isMine ? "mine" : "other"}
      "
      style="
        max-width:75%;
      "
    >
      ${renderMessageContent(
        message
      )}

      <div
        class="
          d-flex
          justify-content-between
          align-items-center
          mt-1
          small
          text-muted
        "
      >
        <span>
          ${formatTime(
            message.created_at
          )}
        </span>

        ${
          isMine
            ? renderMessageStatus(
                message
              )
            : ""
        }
      </div>
    </div>
  `;

  container.appendChild(
    wrapper
  );

  scrollChatBottom();
}

/* ============================================================
   💬 MESSAGE CONTENT
============================================================ */
function renderMessageContent(
  message
) {
  const type =
    message.message_type ||
    "text";

  const content =
    message.content || "";

  /* ========================================================
     🖼️ IMAGE
  ======================================================== */
  if (type === "image") {
    return `
      <img
        src="${
          message.attachments?.[0]
            ?.file_url || ""
        }"
        class="img-fluid rounded"
        style="
          max-height:240px;
          object-fit:cover;
        "
      />
    `;
  }

  /* ========================================================
     🎥 VIDEO
  ======================================================== */
  if (type === "video") {
    return `
      <video
        controls
        class="w-100 rounded"
        style="
          max-height:260px;
        "
      >
        <source
          src="${
            message.attachments?.[0]
              ?.file_url || ""
          }"
        />
      </video>
    `;
  }

  /* ========================================================
     🎵 AUDIO
  ======================================================== */
  if (type === "audio") {
    return `
      <audio
        controls
        class="w-100"
      >
        <source
          src="${
            message.attachments?.[0]
              ?.file_url || ""
          }"
        />
      </audio>
    `;
  }

  /* ========================================================
     📎 DOCUMENT
  ======================================================== */
  if (
    type === "document"
  ) {
    return `
      <div
        class="
          d-flex
          align-items-center
          gap-2
        "
      >
        <i
          class="
            fa fa-file
            text-primary
          "
        ></i>

        <a
          href="${
            message.attachments?.[0]
              ?.file_url || "#"
          }"
          target="_blank"
          class="
            text-decoration-none
          "
        >
          ${
            message.attachments?.[0]
              ?.original_file_name ||
            "Attachment"
          }
        </a>
      </div>
    `;
  }

  /* ========================================================
     📝 TEXT
  ======================================================== */
  return `
    <div
      class="
        message-text
      "
    >
      ${escapeHtml(content)}
    </div>
  `;
}

/* ============================================================
   👁️ MESSAGE STATUS
============================================================ */
function renderMessageStatus(
  message
) {
  const delivered =
    !!message.delivered_at;

  const read =
    !!message.read_at;

  return `
    <span
      class="
        text-${
          read
            ? "success"
            : delivered
              ? "info"
              : "secondary"
        }
      "
    >
      <i
        class="
          fa ${
            read
              ? "fa-check-double"
              : delivered
                ? "fa-check-double"
                : "fa-check"
          }
        "
      ></i>
    </span>
  `;
}

/* ============================================================
   ✍️ TYPING INDICATOR
============================================================ */
export function renderTypingIndicator(
  userId
) {
  const container =
    document.getElementById(
      "typingIndicator"
    );

  if (!container) return;

  container.innerHTML = `
    <div
      class="
        small
        text-muted
        px-2
      "
    >
      ✍️ Typing...
    </div>
  `;
}

export function removeTypingIndicator() {
  const container =
    document.getElementById(
      "typingIndicator"
    );

  if (container) {
    container.innerHTML = "";
  }
}

/* ============================================================
   📎 ATTACHMENT PREVIEW
============================================================ */
export function renderAttachmentPreview(
  files = []
) {
  const container =
    document.getElementById(
      "attachmentPreview"
    );

  if (!container) return;

  container.innerHTML = "";

  files.forEach((file) => {
    const div =
      document.createElement("div");

    div.className =
      `
      border rounded
      p-2 mb-2
      small
      d-flex
      align-items-center
      gap-2
    `;

    div.innerHTML = `
      <i
        class="
          fa fa-paperclip
          text-primary
        "
      ></i>

      <span
        class="
          text-truncate
        "
      >
        ${file.name}
      </span>

      <span
        class="
          text-muted
          ms-auto
        "
      >
        ${formatFileSize(
          file.size
        )}
      </span>
    `;

    container.appendChild(
      div
    );
  });
}

/* ============================================================
   ✅ MARK MESSAGE DELIVERED
============================================================ */
export function markMessageDeliveredUI(
  messageId
) {
  const bubble =
    document.querySelector(
      `[data-message-id="${messageId}"]`
    );

  if (!bubble) return;

  const icon =
    bubble.querySelector(
      ".fa-check"
    );

  if (!icon) return;

  icon.classList.remove(
    "fa-check"
  );

  icon.classList.add(
    "fa-check-double"
  );

  icon.parentElement.classList.remove(
    "text-secondary"
  );

  icon.parentElement.classList.add(
    "text-info"
  );
}

/* ============================================================
   ✅ MARK MESSAGE READ
============================================================ */
export function markMessageReadUI(
  messageId
) {
  const bubble =
    document.querySelector(
      `[data-message-id="${messageId}"]`
    );

  if (!bubble) return;

  const icon =
    bubble.querySelector(
      ".fa-check-double"
    );

  if (!icon) return;

  icon.parentElement.classList.remove(
    "text-info"
  );

  icon.parentElement.classList.add(
    "text-success"
  );
}

/* ============================================================
   🔒 LOCKED UI
============================================================ */
export function markConversationLockedUI() {
  const input =
    document.getElementById(
      "messageInput"
    );

  const button =
    document.querySelector(
      "#messageForm button[type='submit']"
    );

  if (input) {
    input.disabled = true;

    input.placeholder =
      "Conversation locked";
  }

  if (button) {
    button.disabled = true;
  }
}

/* ============================================================
   📋 CONVERSATION CARD
============================================================ */
export function renderConversationCard(
  convo
) {
  return `
    <div
      class="
        conversation-card
        border-bottom
        p-2
        cursor-pointer
      "
      data-id="${convo.id}"
    >
      <div
        class="
          d-flex
          justify-content-between
          align-items-start
        "
      >
        <div>
          <div
            class="
              fw-semibold
            "
          >
            ${
              convo.topic ||
              "Conversation"
            }
          </div>

          <div
            class="
              text-muted
              small
              text-truncate
            "
          >
            ${
              convo.last_message ||
              "No messages yet"
            }
          </div>
        </div>

        ${
          convo.unread_count
            ? `
            <span
              class="
                badge
                bg-danger
              "
            >
              ${convo.unread_count}
            </span>
          `
            : ""
        }
      </div>
    </div>
  `;
}

/* ============================================================
   ⏱️ FORMAT TIME
============================================================ */
function formatTime(
  value
) {
  if (!value) return "";

  const d = new Date(value);

  return d.toLocaleTimeString(
    [],
    {
      hour:"2-digit",
      minute:"2-digit",
    }
  );
}

/* ============================================================
   📦 FORMAT FILE SIZE
============================================================ */
function formatFileSize(
  bytes = 0
) {
  if (bytes < 1024)
    return `${bytes} B`;

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

/* ============================================================
   🔽 AUTO SCROLL
============================================================ */
export function scrollChatBottom() {
  const container =
    document.getElementById(
      "chatMessages"
    );

  if (!container) return;

  container.scrollTop =
    container.scrollHeight;
}

/* ============================================================
   🔒 ESCAPE HTML
============================================================ */
function escapeHtml(
  unsafe = ""
) {
  return unsafe
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}