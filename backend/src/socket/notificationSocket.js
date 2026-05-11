// 📁 backend/src/socket/notificationSocket.js
// ============================================================================
// 🔔 Notification Socket
// ----------------------------------------------------------------------------
// ✅ Enterprise realtime notifications
// ✅ User-targeted alerts
// ✅ Broadcast alerts
// ✅ Unread badge updates
// ✅ Ticket + message notifications
// ✅ Delivery tracking
// ✅ Presence tracking
// ============================================================================

/* ============================================================
   🌍 ONLINE USERS
============================================================ */
const onlineUsers = new Map();

/* ============================================================
   🚀 NOTIFICATION SOCKET
============================================================ */
export default function notificationSocket(
  io,
  socket
) {
  /* ========================================================
     👤 REGISTER USER
  ======================================================== */
  socket.on(
    "notification:register",
    (payload = {}) => {
      try {
        const {
          user_id,
          organization_id,
          facility_id,
        } = payload;

        if (!user_id) return;

        onlineUsers.set(user_id,{
          socketId:socket.id,
          organization_id,
          facility_id,
          connected_at:new Date(),
        });

        socket.user_id = user_id;

        socket.join(`user:${user_id}`);

        io.emit(
          "notification:online-users",
          {
            users:Array.from(
              onlineUsers.keys()
            ),
          }
        );

        console.log(
          `🔔 Notification user registered: ${user_id}`
        );
      } catch (err) {
        console.error(
          "notification:register error",
          err
        );
      }
    }
  );

  /* ========================================================
     🔔 SEND USER NOTIFICATION
  ======================================================== */
  socket.on(
    "notification:send",
    async (payload = {}) => {
      try {
        const {
          user_id,
          notification,
        } = payload;

        if (!user_id) return;

        io.to(`user:${user_id}`).emit(
          "notification:new",
          notification
        );

        io.to(`user:${user_id}`).emit(
          "notification:badge-update",
          {
            unread:true,
            notification_id:
              notification?.id,
          }
        );

        io.to(`user:${user_id}`).emit(
          "notification:delivered",
          {
            notification_id:
              notification?.id,

            delivered_at:
              new Date(),
          }
        );
      } catch (err) {
        console.error(
          "notification:send error",
          err
        );
      }
    }
  );

  /* ========================================================
     📢 BROADCAST NOTIFICATION
  ======================================================== */
  socket.on(
    "notification:broadcast",
    async (payload = {}) => {
      try {
        const {
          notification,
        } = payload;

        io.emit(
          "notification:broadcast",
          notification
        );
      } catch (err) {
        console.error(
          "notification:broadcast error",
          err
        );
      }
    }
  );

  /* ========================================================
     ✅ MARK AS READ
  ======================================================== */
  socket.on(
    "notification:read",
    async (payload = {}) => {
      try {
        const {
          user_id,
          notification_id,
        } = payload;

        io.to(`user:${user_id}`).emit(
          "notification:read",
          {
            notification_id,
            read_at:new Date(),
          }
        );

        io.to(`user:${user_id}`).emit(
          "notification:badge-update",
          {
            unread:false,
            notification_id,
          }
        );
      } catch (err) {
        console.error(
          "notification:read error",
          err
        );
      }
    }
  );

  /* ========================================================
     👀 MARK AS SEEN
  ======================================================== */
  socket.on(
    "notification:seen",
    async (payload = {}) => {
      try {
        const {
          user_id,
          notification_id,
        } = payload;

        io.to(`user:${user_id}`).emit(
          "notification:seen",
          {
            notification_id,
            seen_at:new Date(),
          }
        );
      } catch (err) {
        console.error(
          "notification:seen error",
          err
        );
      }
    }
  );

  /* ========================================================
     ❌ DISCONNECT
  ======================================================== */
  socket.on(
    "disconnect",
    async () => {
      try {
        if (socket.user_id) {
          onlineUsers.delete(
            socket.user_id
          );
        }

        io.emit(
          "notification:online-users",
          {
            users:Array.from(
              onlineUsers.keys()
            ),
          }
        );

        console.log(
          `🔔 Notification user disconnected: ${socket.user_id}`
        );
      } catch (err) {
        console.error(
          "notification disconnect error",
          err
        );
      }
    }
  );
}