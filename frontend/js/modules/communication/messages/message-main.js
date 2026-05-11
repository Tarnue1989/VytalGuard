// 📁 frontend/js/modules/communication/messages/message-main.js
// ============================================================================
// 💬 Message Main – Enterprise MASTER Engine
// ----------------------------------------------------------------------------
// ✅ Conversation loading
// ✅ Sidebar rendering
// ✅ Chat initialization
// ✅ Realtime setup
// ✅ Pagination/search-ready
// ✅ Delivery + read lifecycle
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";

import {
  renderConversationCard,
  appendMessageBubble,
  scrollChatBottom,
  markConversationLockedUI,
} from "./message-render.js";

import {
  setupMessageActions,
  joinConversation,
  leaveConversation,
  markMessageRead,
} from "./message-actions.js";

import {
  initMessageSocket,
} from "./message-socket.js";

/* ============================================================
   🔐 AUTH
============================================================ */
const token =
  initPageGuard(
    autoPagePermissionKey()
  );

initLogoutWatcher();

/* ============================================================
   👤 USER
============================================================ */
const user = {
  id:
    localStorage.getItem(
      "userId"
    ),

  role:
    localStorage.getItem(
      "userRole"
    ),

  permissions:
    JSON.parse(
      localStorage.getItem(
        "permissions"
      ) || "[]"
    ),
};

/* ============================================================
   🌍 STATE
============================================================ */
let socket = null;

let currentConversation =
  null;

let conversations = [];

let messages = [];

/* ============================================================
   📦 DOM
============================================================ */
const conversationList =
  document.getElementById(
    "conversationList"
  );

const chatMessages =
  document.getElementById(
    "chatMessages"
  );

const chatTitle =
  document.getElementById(
    "chatTitle"
  );

const emptyChat =
  document.getElementById(
    "emptyChat"
  );

/* ============================================================
   🚀 INIT MODULE
============================================================ */
export async function initMessageModule() {
  try {
    showLoading();

    /* ========================================================
       ⚡ SOCKET
    ======================================================== */
    socket =
      initMessageSocket({
        user,
      });

    /* ========================================================
       📦 LOAD CONVERSATIONS
    ======================================================== */
    await loadConversations();

    /* ========================================================
       🎛️ ACTIONS
    ======================================================== */
    setupMessageActions({
      socket,
      user,
      conversationId:
        currentConversation,
    });

  } catch (err) {
    console.error(err);

    showToast(
      "❌ Failed to initialize messaging"
    );

  } finally {
    hideLoading();
  }

  setTimeout(() => {
    initMobileChatSwitch();
  }, 0);
}

/* ============================================================
   📋 LOAD CONVERSATIONS
============================================================ */
async function loadConversations() {
  try {
    showLoading();

    const res =
      await authFetch(
        "/api/conversations"
      );

    const data =
      await res.json();

    conversations =
      data?.data?.records ||
      [];

    renderConversationList();

    /* ========================================================
       🔥 AUTO OPEN FIRST
    ======================================================== */
    if (
      conversations.length
    ) {
      await openConversation(
        conversations[0].id
      );
    }

  } catch (err) {
    console.error(err);

    showToast(
      "❌ Failed to load conversations"
    );

  } finally {
    hideLoading();
  }
}

/* ============================================================
   📋 RENDER CONVERSATION LIST
============================================================ */
function renderConversationList() {
  if (!conversationList)
    return;

  conversationList.innerHTML =
    "";

  conversations.forEach(
    (convo) => {
      const div =
        document.createElement(
          "div"
        );

      div.innerHTML =
        renderConversationCard(
          convo
        );

      const card =
        div.firstElementChild;

      card.addEventListener(
        "click",
        async () => {
          await openConversation(
            convo.id
          );
        }
      );

      conversationList.appendChild(
        card
      );
    }
  );
}

/* ============================================================
   📩 OPEN CONVERSATION
============================================================ */
async function openConversation(
  conversationId
) {
  if (!conversationId) return;

  try {
    showLoading();

    /* ========================================================
       🚪 LEAVE PREVIOUS ROOM
    ======================================================== */
    if (
      currentConversation &&
      currentConversation !==
      conversationId
    ) {
      leaveConversation(
        currentConversation
      );
    }

    currentConversation =
      conversationId;

    /* ========================================================
       🚪 JOIN ROOM
    ======================================================== */
    joinConversation(
      conversationId
    );

    /* ========================================================
       📱 MOBILE UI SWITCH
    ======================================================== */
    const layout =
      document.querySelector(
        ".messages-layout"
      );

    if (
      layout &&
      window.innerWidth <= 576
    ) {
      layout.classList.add(
        "chat-open"
      );
    }

    /* ========================================================
       🟢 ACTIVE HIGHLIGHT
    ======================================================== */
    document
      .querySelectorAll(
        ".conversation-card"
      )
      .forEach((el) =>
        el.classList.remove(
          "active"
        )
      );

    const active =
      document.querySelector(
        `[data-id="${conversationId}"]`
      );

    if (active) {
      active.classList.add(
        "active"
      );
    }

    /* ========================================================
       📦 LOAD MESSAGES
    ======================================================== */
    const res =
      await authFetch(
        `/api/messages?conversation_id=${conversationId}`
      );

    const data =
      await res.json();

    messages =
      data?.data?.records ||
      [];

    /* ========================================================
       💬 RENDER
    ======================================================== */
    renderMessages();

    /* ========================================================
       🧠 CHAT TITLE
    ======================================================== */
    const convo =
      conversations.find(
        (x) =>
          String(x.id) ===
          String(conversationId)
      );

    if (chatTitle) {
      chatTitle.textContent =
        convo?.topic ||
        "Conversation";
    }

    /* ========================================================
       🔒 LOCKED UI
    ======================================================== */
    if (convo?.is_locked) {
      markConversationLockedUI();
    }

    /* ========================================================
       👁 EMPTY STATE
    ======================================================== */
    if (emptyChat) {
      emptyChat.style.display =
        messages.length
          ? "none"
          : "flex";
    }

    /* ========================================================
       📍 AUTO SCROLL
    ======================================================== */
    scrollChatBottom();

  } catch (err) {
    console.error(err);

    showToast(
      "❌ Failed to load messages"
    );

  } finally {
    hideLoading();
  }
}

/* ============================================================
   💬 RENDER MESSAGES
============================================================ */
function renderMessages() {
  if (!chatMessages)
    return;

  chatMessages.innerHTML =
    "";

  if (!messages.length) {
    if (emptyChat) {
      emptyChat.style.display =
        "flex";
    }

    return;
  }

  if (emptyChat) {
    emptyChat.style.display =
      "none";
  }

  messages.forEach(
    (message) => {
      appendMessageBubble(
        message,
        user
      );

      if (
        !message?.is_read
      ) {
        markMessageRead(
          message.id
        );
      }
    }
  );

  scrollChatBottom();
}

/* ============================================================
   🔎 SEARCH CONVERSATIONS
============================================================ */
const searchInput =
  document.getElementById(
    "conversationSearch"
  );

if (searchInput) {
  searchInput.addEventListener(
    "input",
    () => {
      const value =
        searchInput.value
          .toLowerCase()
          .trim();

      const cards =
        document.querySelectorAll(
          "#conversationList > div"
        );

      cards.forEach(
        (card) => {
          const text =
            card.textContent
              .toLowerCase();

          card.style.display =
            text.includes(
              value
            )
              ? ""
              : "none";
        }
      );
    }
  );
}

/* ============================================================
   🌍 GLOBAL HELPERS
============================================================ */
window.openConversation =
  openConversation;

/* ============================================================
   🚀 BOOT
============================================================ */
document.readyState ===
"loading"
  ? document.addEventListener(
      "DOMContentLoaded",
      initMessageModule
    )
  : initMessageModule();

/* ============================================================
   📱 MOBILE CHAT SWITCH
============================================================ */
function initMobileChatSwitch() {
  const layout =
    document.querySelector(
      ".messages-layout"
    );

  const backBtn =
    document.getElementById(
      "backToListBtn"
    );

  if (!layout) return;

  /* ========================================================
     🔙 BACK BUTTON
  ======================================================== */
  if (backBtn) {
    backBtn.addEventListener(
      "click",
      () => {
        layout.classList.remove(
          "chat-open"
        );
      }
    );
  }

  /* ========================================================
     🔁 RESIZE RESET
  ======================================================== */
  window.addEventListener(
    "resize",
    () => {
      if (
        window.innerWidth > 576
      ) {
        layout.classList.remove(
          "chat-open"
        );
      }
    }
  );

  /* ========================================================
     🔄 ROTATION FIX
  ======================================================== */
  window.addEventListener(
    "orientationchange",
    () => {
      setTimeout(() => {
        if (
          window.innerWidth > 576
        ) {
          layout.classList.remove(
            "chat-open"
          );
        }
      }, 150);
    }
  );
}