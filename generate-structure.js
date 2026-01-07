// generate-structure.js (ESM)
// Run with: node generate-structure.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// 1. Directory structure
// -----------------------------
const dirs = [
  // Docs & infra
  "docs/architecture", "docs/db", "docs/api", "docs/ui",
  "infra/docker", "infra/k8s", "infra/scripts", "infra/ci",

  // Backend core
  "backend/src/config",
  "backend/src/db/migrations", "backend/src/db/seeders", "backend/src/db/sequelize-meta",
  "backend/src/models", "backend/src/constants", "backend/src/middleware",
  "backend/src/policies", "backend/src/validators", "backend/src/services",
  "backend/src/controllers", "backend/src/routes", "backend/src/utils",
  "backend/src/jobs",
  "backend/test/unit", "backend/test/integration",

  // Frontend assets & shared
  "frontend/public/assets/css", "frontend/public/assets/fonts",
  "frontend/public/assets/images", "frontend/public/assets/libs",
  "frontend/js/utils", "frontend/js/constants", "frontend/js/components",

  // Frontend modules
  "frontend/js/modules/patients",
  "frontend/js/modules/registrations",
  "frontend/js/modules/consultations",
  "frontend/js/modules/maternity",
  "frontend/js/modules/delivery",
  "frontend/js/modules/surgery",
  "frontend/js/modules/ekg",
  "frontend/js/modules/ultrasound",
  "frontend/js/modules/prescriptions",
  "frontend/js/modules/inventory",
  "frontend/js/modules/billing",
];

// -----------------------------
// 2. Files to create
// -----------------------------
const files = [
  // Backend entry & config
  "backend/src/app.js", "backend/src/server.js", "backend/src/config/index.js",
  "backend/src/utils/logger.js",

  // Backend constants
  "backend/src/constants/enums.js", "backend/src/constants/fieldLabels.js",
  "backend/src/constants/fieldOrder.js", "backend/src/constants/fieldDefaults.js",
  "backend/src/constants/fieldVisibility.js", "backend/src/constants/moduleFields.js",

  // Frontend entry
  "frontend/public/index.html", "frontend/js/app.js",

  // Patients
  "frontend/js/modules/patients/patients-main.js",
  "frontend/js/modules/patients/patients-actions.js",
  "frontend/js/modules/patients/patients-render.js",
  "frontend/js/modules/patients/patients-constants.js",
  "frontend/js/modules/patients/patients-form.js",

  // Registrations
  "frontend/js/modules/registrations/registrations-main.js",
  "frontend/js/modules/registrations/registrations-actions.js",
  "frontend/js/modules/registrations/registrations-render.js",
  "frontend/js/modules/registrations/registrations-constants.js",
  "frontend/js/modules/registrations/registrations-form.js",

  // Consultations
  "frontend/js/modules/consultations/consultations-main.js",
  "frontend/js/modules/consultations/consultations-actions.js",
  "frontend/js/modules/consultations/consultations-render.js",
  "frontend/js/modules/consultations/consultations-constants.js",
  "frontend/js/modules/consultations/consultations-form.js",

  // Maternity
  "frontend/js/modules/maternity/maternity-main.js",
  "frontend/js/modules/maternity/maternity-actions.js",
  "frontend/js/modules/maternity/maternity-render.js",
  "frontend/js/modules/maternity/maternity-constants.js",
  "frontend/js/modules/maternity/maternity-form.js",

  // Delivery
  "frontend/js/modules/delivery/delivery-main.js",
  "frontend/js/modules/delivery/delivery-actions.js",
  "frontend/js/modules/delivery/delivery-render.js",
  "frontend/js/modules/delivery/delivery-constants.js",
  "frontend/js/modules/delivery/delivery-form.js",

  // Surgery
  "frontend/js/modules/surgery/surgery-main.js",
  "frontend/js/modules/surgery/surgery-actions.js",
  "frontend/js/modules/surgery/surgery-render.js",
  "frontend/js/modules/surgery/surgery-constants.js",
  "frontend/js/modules/surgery/surgery-form.js",

  // EKG
  "frontend/js/modules/ekg/ekg-main.js",
  "frontend/js/modules/ekg/ekg-actions.js",
  "frontend/js/modules/ekg/ekg-render.js",
  "frontend/js/modules/ekg/ekg-constants.js",
  "frontend/js/modules/ekg/ekg-form.js",

  // Ultrasound
  "frontend/js/modules/ultrasound/ultrasound-main.js",
  "frontend/js/modules/ultrasound/ultrasound-actions.js",
  "frontend/js/modules/ultrasound/ultrasound-render.js",
  "frontend/js/modules/ultrasound/ultrasound-constants.js",
  "frontend/js/modules/ultrasound/ultrasound-form.js",

  // Prescriptions
  "frontend/js/modules/prescriptions/prescriptions-main.js",
  "frontend/js/modules/prescriptions/prescriptions-actions.js",
  "frontend/js/modules/prescriptions/prescriptions-render.js",
  "frontend/js/modules/prescriptions/prescriptions-constants.js",
  "frontend/js/modules/prescriptions/prescriptions-form.js",

  // Inventory
  "frontend/js/modules/inventory/inventory-main.js",
  "frontend/js/modules/inventory/inventory-actions.js",
  "frontend/js/modules/inventory/inventory-render.js",
  "frontend/js/modules/inventory/inventory-constants.js",
  "frontend/js/modules/inventory/inventory-form.js",
  "frontend/js/modules/inventory/stockrequests-main.js",
  "frontend/js/modules/inventory/stockrequests-actions.js",
  "frontend/js/modules/inventory/stockrequests-render.js",
  "frontend/js/modules/inventory/stockrequests-constants.js",
  "frontend/js/modules/inventory/stockrequests-form.js",

  // Billing
  "frontend/js/modules/billing/billing-main.js",
  "frontend/js/modules/billing/billing-constants.js",
  "frontend/js/modules/billing/invoices-actions.js",
  "frontend/js/modules/billing/payments-actions.js",
  "frontend/js/modules/billing/invoices-form.js",
  "frontend/js/modules/billing/payments-form.js",
];

// -----------------------------
// 3. Minimal boilerplate content
// -----------------------------
const boilerplate = {
  "backend/src/app.js":
`import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

export default app;`,

  "backend/src/server.js":
`import "dotenv/config";
import http from "http";
import app from "./app.js";

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
server.listen(PORT, () => console.log("🚀 Server running on port", PORT));`,

  "backend/src/config/index.js":
`export const env = process.env.NODE_ENV || "development";
export const port = process.env.PORT || 5000;`,

  "backend/src/utils/logger.js":
`export const logger = { info: console.log, error: console.error, warn: console.warn };`,

  "frontend/public/index.html":
`<!doctype html>
<html>
<head><meta charset="utf-8"/><title>VytalGuard</title></head>
<body>
<div id="app">VytalGuard UI</div>
<script type="module" src="/js/app.js"></script>
</body>
</html>`,

  "frontend/js/app.js":
`console.log("VytalGuard frontend boot");`,
};

// -----------------------------
// 4. Helpers
// -----------------------------
function ensureDir(p) {
  const full = path.resolve(p);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
    console.log("📁 Created:", p);
  }
}

function ensureFile(p) {
  const full = path.resolve(p);
  if (!fs.existsSync(full)) {
    const content = boilerplate[p] || "";
    fs.writeFileSync(full, content, "utf8");
    console.log("📄 Created:", p);
  }
}

// -----------------------------
// 5. Run generator
// -----------------------------
dirs.forEach(ensureDir);
files.forEach(ensureFile);

console.log("\n✅ Folder structure generated successfully with ESM boilerplate!");
