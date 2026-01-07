// 📁 backend/src/services/qrService.js
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

// ✅ Use the same folder as multer + server.js
const QR_DIR = path.join(process.cwd(), "uploads", "patients", "qr");

// Ensure directory exists
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

/**
 * Generate a QR code PNG file for a patient
 * @param {string} patientId - Patient UUID
 * @param {string} patNo - Patient number (optional, included for readability)
 * @returns {string} relative file path for storage in DB
 */
export async function generatePatientQR(patientId, patNo) {
  const qrFileName = `${patientId}.png`;
  const qrFilePath = path.join(QR_DIR, qrFileName);

  const payload = { id: patientId, pat_no: patNo || null };
  const qrContent = JSON.stringify(payload);

  await QRCode.toFile(qrFilePath, qrContent, {
    color: { dark: "#000000", light: "#FFFFFF" },
    width: 300,
  });

  // ✅ Path frontend can load (served by Express)
  return `/uploads/patients/qr/${qrFileName}`;
}
