// 📁 frontend/js/modules/communication/messages/message-socket.js
// ============================================================================
// 💬 Message Socket Service
// ----------------------------------------------------------------------------
// ✅ Socket.IO client
// ✅ Auto reconnect
// ✅ User registration
// ✅ Centralized socket management
// ✅ Heartbeat support
// ✅ Online presence
// ============================================================================

import { io } from "socket.io-client";

import {
  SOCKET_EVENTS,
} from "./message-constants.js";

let socket = null;

/* ============================================================
   🚀 INIT SOCKET
============================================================ */
export function initMessageSocket({
  user,
}) {
  if (socket) return socket;

  /* ========================================================
     🌍 SOCKET INIT
  ======================================================== */
  socket = io(
    window.location.origin,
    {
      transports:[
        "websocket",
        "polling",
      ],

      reconnection:true,

      reconnectionAttempts:10,

      reconnectionDelay:1000,

      timeout:20000,
    }
  );

  /* ========================================================
     🔌 CONNECT
  ======================================================== */
  socket.on(
    "connect",
    () => {
      console.log(
        "💬 Socket connected"
      );

      /* ====================================================
         👤 REGISTER USER
      ==================================================== */
      socket.emit(
        SOCKET_EVENTS.REGISTER,
        {
          user_id:
            user?.id,

          organization_id:
            localStorage.getItem(
              "organizationId"
            ),

          facility_id:
            localStorage.getItem(
              "facilityId"
            ),
        }
      );

      startHeartbeat();
    }
  );

  /* ========================================================
     ❌ DISCONNECT
  ======================================================== */
  socket.on(
    "disconnect",
    () => {
      console.log(
        "💬 Socket disconnected"
      );
    }
  );

  /* ========================================================
     🔁 RECONNECT
  ======================================================== */
  socket.on(
    "reconnect",
    () => {
      console.log(
        "💬 Socket reconnected"
      );

      socket.emit(
        SOCKET_EVENTS.REGISTER,
        {
          user_id:
            user?.id,

          organization_id:
            localStorage.getItem(
              "organizationId"
            ),

          facility_id:
            localStorage.getItem(
              "facilityId"
            ),
        }
      );
    }
  );

  /* ========================================================
     ⚠️ CONNECT ERROR
  ======================================================== */
  socket.on(
    "connect_error",
    (err) => {
      console.error(
        "Socket connection error",
        err
      );
    }
  );

  /* ========================================================
     ❤️ PONG
  ======================================================== */
  socket.on(
    "socket:pong",
    (payload) => {
      console.log(
        "💓 Socket heartbeat",
        payload
      );
    }
  );

  return socket;
}

/* ============================================================
   ❤️ HEARTBEAT
============================================================ */
function startHeartbeat() {
  setInterval(() => {
    if (!socket) return;

    socket.emit(
      "socket:ping"
    );
  }, 30000);
}

/* ============================================================
   🔌 GET SOCKET
============================================================ */
export function getSocket() {
  return socket;
}

/* ============================================================
   ❌ DISCONNECT SOCKET
============================================================ */
export function disconnectSocket() {
  if (!socket) return;

  socket.disconnect();

  socket = null;
}