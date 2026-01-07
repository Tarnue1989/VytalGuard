// 📦 utils/file-preview.js – Universal File Preview Helper
// ============================================================================
// 🔹 Enterprise-standard preview for images & files
// 🔹 Reused by: patient-form.js, employee-form.js, delivery-record-form.js, etc.
// 🔹 Automatically handles <img> vs <a> rendering, removal buttons, and hidden flags
// ============================================================================

/**
 * Setup file preview with consistent enterprise behavior.
 * 
 * @param {string} inputId - File input element ID
 * @param {string} previewId - Preview container element ID
 * @param {string} removeBtnId - Remove button element ID
 * @param {string} fieldName - Field key (e.g. "photo_path" or "resume_url")
 */
export function setupFilePreview(inputId, previewId, removeBtnId, fieldName) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const removeBtn = document.getElementById(removeBtnId);
  const flag =
    document.getElementById(`remove_${fieldName}`) ||
    document.getElementById(`remove_${fieldName.split("_")[0]}`);

  if (!input || !preview || !removeBtn) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    // 🖼️ Image preview or file link
    if (file.type.startsWith("image/")) {
      preview.innerHTML = `
        <img src="${URL.createObjectURL(file)}"
             class="preview-img"
             alt="Preview"
             onerror="this.style.display='none';" />
      `;
    } else {
      preview.innerHTML = `
        <a href="${URL.createObjectURL(file)}"
           target="_blank"
           rel="noopener noreferrer">${file.name}</a>
      `;
    }

    removeBtn.classList.remove("hidden");
    if (flag) flag.value = "false";
  });

  removeBtn.addEventListener("click", () => {
    input.value = "";
    preview.innerHTML = "";
    removeBtn.classList.add("hidden");
    if (flag) flag.value = "true";
  });
}
