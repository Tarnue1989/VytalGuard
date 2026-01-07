/* -------------------- File Upload Middleware -------------------- */
import multer from "multer";
import path from "path";
import fs from "fs";

// 📂 Ensure target directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 📁 Define disk storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "uploads/misc";

    // Normalize fieldname (strip out array-style keys e.g., results[0][attachment])
    const field = file.fieldname.replace(/\[\d+\]/g, "");

    switch (field) {
      /* ---------- Employee ---------- */
      case "employee_photo":   // Employee profile photo
        folder = "uploads/employees";
        break;
      case "resume_url":       // Employee resume
        folder = "uploads/resumes";
        break;
      case "document_url":     // Employee supporting docs
        folder = "uploads/documents";
        break;

      /* ---------- Patient ---------- */
      case "photo_path":       // Patient profile photo
        folder = "uploads/patients";
        break;

      /* ---------- Lab Results ---------- */
      case "lab_result_file":  // Primary lab result file
      case "attachment":       // Generic attachment (per pill)
        folder = "uploads/lab-results";
        break;

      /* ---------- Other modules ---------- */
      case "logo":
        folder = "uploads/logos";
        break;
      case "favicon":
        folder = "uploads/favicons";
        break;
      case "slide_image":
      case "slide":
        folder = "uploads/slides";
        break;
      case "service_icon":
        folder = "uploads/services";
        break;
      case "announcement_image":
        folder = "uploads/announcements";
        break;
      case "about_image":
        folder = "uploads/about";
        break;
      case "video_thumb":
        folder = "uploads/videos/thumbs";
        break;
      case "video_file":
        folder = "uploads/videos/files";
        break;
      case "ultrasound_file":
        folder = "uploads/ultrasounds";
        break;
      case "report_file":
        folder = "uploads/medical-records";
        break;
      case "message_file":
        folder = "uploads/messages";
        break;
      case "ekg_file":
        folder = "uploads/ekg-records";
        break;
      case "surgery_file":
        folder = "uploads/surgeries";
        break;
    }

    ensureDir(folder);
    cb(null, folder);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = Date.now() + "_" + Math.round(Math.random() * 1e6);

    // Normalize fieldname (strip array notation)
    const field = file.fieldname.replace(/\[\d+\]/g, "");

    // 🏷️ Clean prefix per field
    let prefix = "file";
    switch (field) {
      case "employee_photo":
        prefix = "employee";
        break;
      case "photo_path":
        prefix = "patient";
        break;
      case "resume_url":
        prefix = "resume";
        break;
      case "document_url":
        prefix = "doc";
        break;
      case "logo":
        prefix = "logo";
        break;
      case "favicon":
        prefix = "favicon";
        break;
      default:
        prefix = field.replace(/_url$|_file$/, "");
    }

    cb(null, `${prefix}-${unique}${ext}`);
  }
});

// 🛡️ File validation
function fileFilter(req, file, cb) {
  // Normalize fieldname to handle indexed keys (results[0][attachment])
  const field = file.fieldname.replace(/\[\d+\]/g, "");

  const allowedFields = [
    // Employee
    "employee_photo", "resume_url", "document_url",
    // Patient
    "photo_path",
    // Lab Results
    "lab_result_file", "attachment",
    // Other modules
    "logo", "favicon", "slide_image", "slide", "service_icon",
    "announcement_image", "about_image", "video_thumb", "video_file",
    "ultrasound_file", "report_file", "message_file",
    "ekg_file", "surgery_file"
  ];

  if (!allowedFields.includes(field)) {
    return cb(new Error("Invalid field for file upload"), false);
  }

  cb(null, true);
}

const baseMulter = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB cap
});

/* ============================================================
   ✅ Exported Uploaders
   ============================================================ */
export const uploadEmployee = baseMulter.fields([
  { name: "employee_photo", maxCount: 1 },
  { name: "resume_url", maxCount: 1 },
  { name: "document_url", maxCount: 1 }
]);

export const uploadPatient = baseMulter.fields([
  { name: "photo_path", maxCount: 1 }
]);

// 🔄 Changed to accept any files (supports results[0][attachment], results[1][attachment], etc.)
export const uploadLabResult = baseMulter.any();

export const uploadUltrasound = baseMulter.single("ultrasound_file");
export const uploadMedicalRecord = baseMulter.single("report_file");
export const uploadEKG = baseMulter.single("ekg_file"); 
export const uploadGeneric = baseMulter;
