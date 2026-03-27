/* -------------------- File Upload Middleware -------------------- */
import multer from "multer";
import path from "path";
import fs from "fs";

/* ============================================================
   📂 Ensure Directory Exists
============================================================ */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/* ============================================================
   📁 STORAGE CONFIG
============================================================ */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "uploads/misc";

    // Normalize fieldname
    const field = file.fieldname.replace(/\[\d+\]/g, "");

    switch (field) {
      /* ---------- Employee ---------- */
      case "employee_photo":
        folder = "uploads/employees";
        break;
      case "resume_url":
        folder = "uploads/resumes";
        break;
      case "document_url":
        folder = "uploads/documents";
        break;

      /* ---------- Patient ---------- */
      case "photo_path":
        folder = "uploads/patients";
        break;

      /* ---------- Lab Results ---------- */
      case "lab_result_file":
      case "attachment":
        folder = "uploads/lab-results";
        break;

      /* ---------- Branding (FIXED) ---------- */
      case "logo":
      case "logo_print":
        folder = "uploads/logos";
        break;

      case "favicon":
        folder = "uploads/favicons";
        break;

      /* ---------- Other Modules ---------- */
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

    const field = file.fieldname.replace(/\[\d+\]/g, "");

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

      /* ---------- Branding ---------- */
      case "logo":
        prefix = "logo";
        break;

      case "logo_print":
        prefix = "logo-print";
        break;

      case "favicon":
        prefix = "favicon";
        break;

      default:
        prefix = field.replace(/_url$|_file$/, "");
    }

    cb(null, `${prefix}-${unique}${ext}`);
  },
});

/* ============================================================
   🛡️ FILE FILTER
============================================================ */
function fileFilter(req, file, cb) {
  const field = file.fieldname.replace(/\[\d+\]/g, "");

  const allowedFields = [
    /* ---------- Employee ---------- */
    "employee_photo",
    "resume_url",
    "document_url",

    /* ---------- Patient ---------- */
    "photo_path",

    /* ---------- Lab Results ---------- */
    "lab_result_file",
    "attachment",

    /* ---------- Branding (FIXED) ---------- */
    "logo",
    "logo_print",
    "favicon",

    /* ---------- Other Modules ---------- */
    "slide_image",
    "slide",
    "service_icon",
    "announcement_image",
    "about_image",
    "video_thumb",
    "video_file",
    "ultrasound_file",
    "report_file",
    "message_file",
    "ekg_file",
    "surgery_file",
  ];

  if (!allowedFields.includes(field)) {
    return cb(new Error("Invalid field for file upload"), false);
  }

  cb(null, true);
}

/* ============================================================
   🚀 BASE MULTER
============================================================ */
const baseMulter = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

/* ============================================================
   📦 EXPORTS
============================================================ */

// Employee
export const uploadEmployee = baseMulter.fields([
  { name: "employee_photo", maxCount: 1 },
  { name: "resume_url", maxCount: 1 },
  { name: "document_url", maxCount: 1 },
]);

// Patient
export const uploadPatient = baseMulter.fields([
  { name: "photo_path", maxCount: 1 },
]);

// Lab Results (dynamic)
export const uploadLabResult = baseMulter.any();

// Branding (🔥 NEW — USE THIS)
export const uploadBranding = baseMulter.fields([
  { name: "logo", maxCount: 1 },
  { name: "logo_print", maxCount: 1 },
  { name: "favicon", maxCount: 1 },
]);

// Others
export const uploadUltrasound = baseMulter.single("ultrasound_file");
export const uploadMedicalRecord = baseMulter.single("report_file");
export const uploadEKG = baseMulter.single("ekg_file");

// Generic fallback
export const uploadGeneric = baseMulter;