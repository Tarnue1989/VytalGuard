// 📁 backend/src/server.js
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import http from "http";
import https from "https";
import selfsigned from "selfsigned";

import { initSequelize } from "./config/database.js";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { makeModuleLogger, isDebugEnabled } from "./utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (SERVER ONLY)
============================================================ */
const DEBUG_OVERRIDE = true; // ⬅️ set false in normal dev
const log = makeModuleLogger("server", DEBUG_OVERRIDE);

/* ============================================================
   APP SETUP
============================================================ */
const app = express();
// ✅ REQUIRED FOR RENDER / PROXIES
app.set("trust proxy", 1);
const PORT = process.env.PORT || 4000;
const USE_HTTPS = process.env.USE_HTTPS === "true";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "./certs/key.pem";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "./certs/cert.pem";

/* ============================================================
   PATHS
============================================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.resolve(__dirname, "../../uploads");
const publicDir = path.resolve(__dirname, "../../frontend/public");
const frontendJsDir = path.resolve(__dirname, "../../frontend/js");

/* ============================================================
   SECURITY & PARSING
============================================================ */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(compression());

/* ============================================================
   RATE LIMITING (LOGIN ONLY)
============================================================ */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Try again later.",
});
app.use("/api/auth/login", loginLimiter);

/* ============================================================
   HTTP REQUEST LOGGING — API ONLY
============================================================ */
if (isDebugEnabled() || DEBUG_OVERRIDE) {
  app.use(
    morgan("dev", {
      skip: (req) => !req.url.startsWith("/api"),
    })
  );

  log.log("API request logging ENABLED (API only)");
}

/* ============================================================
   HTTPS ENFORCEMENT (PRODUCTION ONLY)
============================================================ */
if (USE_HTTPS && process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1); // ✅ REQUIRED for express-rate-limit safety

  app.use((req, res, next) => {
    if (!req.secure && req.get("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

/* ============================================================
   ROOT
============================================================ */
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

/* ============================================================
   STATIC FILES (NO LOGGING)
============================================================ */
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));

if (fs.existsSync(frontendJsDir)) {
  app.use("/js", express.static(frontendJsDir));
}

/* ============================================================
   API ROUTES
============================================================ */
app.use("/api", routes);

app.get("/health", (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

/* ============================================================
   404 + ERROR HANDLING
============================================================ */
app.use(notFound);
app.use(errorHandler);

/* ============================================================
   BOOT SERVER
============================================================ */
let server;

(async () => {
  try {
    await initSequelize();
    log.log("Database initialized");

    if (USE_HTTPS) {
      let key, cert;

      if (!fs.existsSync(SSL_KEY_PATH) || !fs.existsSync(SSL_CERT_PATH)) {
        log.warn("No SSL cert found — generating self-signed certificate (dev)");

        const attrs = [{ name: "commonName", value: "localhost" }];
        const pems = selfsigned.generate(attrs, { days: 365 });
        key = pems.private;
        cert = pems.cert;

        fs.mkdirSync(path.dirname(SSL_KEY_PATH), { recursive: true });
        fs.writeFileSync(SSL_KEY_PATH, key);
        fs.writeFileSync(SSL_CERT_PATH, cert);
      } else {
        key = fs.readFileSync(path.resolve(SSL_KEY_PATH));
        cert = fs.readFileSync(path.resolve(SSL_CERT_PATH));
      }

      server = https.createServer({ key, cert }, app).listen(PORT, () => {
        log.log(`API listening on https://0.0.0.0:${PORT}`);
      });
    } else {
      server = http.createServer(app).listen(PORT, () => {
        log.log(`API listening on http://0.0.0.0:${PORT}`);
      });
    }
  } catch (err) {
    log.error("Failed to start server", err);
    process.exit(1);
  }
})();

/* ============================================================
   GRACEFUL SHUTDOWN
============================================================ */
const shutdown = (sig) => () => {
  log.warn(`${sig} received, shutting down`);
  if (!server) return process.exit(0);

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
};

["SIGINT", "SIGTERM"].forEach((s) => process.on(s, shutdown(s)));
