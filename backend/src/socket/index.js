// 📁 backend/src/socket/index.js
// ============================================================================
// 🚀 Socket.IO Bootstrap
// ----------------------------------------------------------------------------
// ✅ Enterprise socket registration
// ✅ Chat sockets
// ✅ Notification sockets
// ✅ Central socket initialization
// ✅ Tenant-safe realtime handling
// ✅ Presence-ready architecture
// ============================================================================

import { Server } from "socket.io";

import chatSocket from "./chatSocket.js";

import notificationSocket from "./notificationSocket.js";

/* ============================================================
   🚀 INITIALIZE SOCKET.IO
============================================================ */
export default function initSocket(
  server
) {
  const io = new Server(server,{
    cors:{
      origin:"*",

      methods:[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
      ],

      credentials:true,
    },

    transports:[
      "websocket",
      "polling",
    ],

    pingTimeout:60000,

    pingInterval:25000,
  });

  /* ========================================================
     🌍 SOCKET CONNECTION
  ======================================================== */
  io.on(
    "connection",
    (socket) => {
      console.log(
        `🔌 Socket connected: ${socket.id}`
      );

      /* ====================================================
         🌐 SOCKET META
      ==================================================== */
      socket.connected_at =
        new Date();

      /* ====================================================
         💬 CHAT SOCKET
      ==================================================== */
      chatSocket(io, socket);

      /* ====================================================
         🔔 NOTIFICATION SOCKET
      ==================================================== */
      notificationSocket(
        io,
        socket
      );

      /* ====================================================
         ❤️ HEALTH CHECK
      ==================================================== */
      socket.on(
        "socket:ping",
        () => {
          socket.emit(
            "socket:pong",
            {
              timestamp:
                new Date(),
            }
          );
        }
      );

      /* ====================================================
         ❌ DISCONNECT
      ==================================================== */
      socket.on(
        "disconnect",
        (reason) => {
          console.log(
            `🔌 Socket disconnected: ${socket.id}`
          );

          console.log(
            `❌ Disconnect reason: ${reason}`
          );
        }
      );
    }
  );

  console.log(
    "🚀 Socket.IO initialized"
  );

  return io;
}