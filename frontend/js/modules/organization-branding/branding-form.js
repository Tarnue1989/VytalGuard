// 📁 branding-form.js – FINAL MASTER (FULL + REMOVE HANDLING)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { clearFormErrors } from "../../utils/form-ux.js";
import { authFetch } from "../../authSession.js";

/* ============================================================
   🔐 INIT
============================================================ */
export async function setupBrandingForm({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  /* ============================================================
     🖼️ IMAGE PREVIEW
  ============================================================ */
  function previewImage(file, previewId, removeBtnId, flagId) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById(previewId).innerHTML =
        `<img src="${reader.result}" style="max-height:80px;">`;

      document.getElementById(removeBtnId)?.classList.remove("hidden");
      document.getElementById(flagId).value = "false";
    };
    reader.readAsDataURL(file);
  }

  document.getElementById("logo")?.addEventListener("change", (e) =>
    previewImage(e.target.files[0], "logoPreview", "removeLogoBtn", "remove_logo")
  );

  document.getElementById("logo_print")?.addEventListener("change", (e) =>
    previewImage(e.target.files[0], "logoPrintPreview", "removeLogoPrintBtn", "remove_logo_print")
  );

  document.getElementById("favicon")?.addEventListener("change", (e) =>
    previewImage(e.target.files[0], "faviconPreview", "removeFaviconBtn", "remove_favicon")
  );

  /* ============================================================
     ❌ REMOVE IMAGE HANDLER (PATIENT STYLE)
  ============================================================ */
  function setupRemove(btnId, previewId, flagId) {
    const btn = document.getElementById(btnId);
    const preview = document.getElementById(previewId);
    const flag = document.getElementById(flagId);

    if (!btn || !preview || !flag) return;

    btn.addEventListener("click", () => {
      preview.innerHTML = "";
      flag.value = "true";
      btn.classList.add("hidden");
    });
  }

  setupRemove("removeLogoBtn", "logoPreview", "remove_logo");
  setupRemove("removeLogoPrintBtn", "logoPrintPreview", "remove_logo_print");
  setupRemove("removeFaviconBtn", "faviconPreview", "remove_favicon");

  /* ============================================================
     📥 LOAD EXISTING BRANDING
  ============================================================ */
  async function loadBranding() {
    try {
      showLoading();

      const res = await authFetch("/api/organization-branding");
      const json = await res.json();

      if (!res.ok) throw new Error(json.message);

      const data = json.data || {};

      /* ================= BASIC ================= */
      document.getElementById("company_name").value = data.company_name || "";
      document.getElementById("tagline").value = data.tagline || "";

      document.getElementById("contact_address").value = data.contact?.address || "";
      document.getElementById("contact_phone").value = data.contact?.phone || "";
      document.getElementById("contact_email").value = data.contact?.email || "";

      document.getElementById("theme_primary").value = data.theme?.primary || "#0f62fe";
      document.getElementById("theme_secondary").value = data.theme?.secondary || "#6f6f6f";
      document.getElementById("theme_surface").value = data.theme?.surface || "#ffffff";
      document.getElementById("theme_text").value = data.theme?.text || "#111827";

      document.getElementById("currency").value = data.currency || "USD";
      document.getElementById("locale").value = data.locale || "en-US";
      document.getElementById("timezone").value = data.timezone || "UTC";

      document.getElementById("letterhead_header").value = data.letterhead_header || "";
      document.getElementById("letterhead_footer").value = data.letterhead_footer || "";

      document.getElementById("social_facebook").value = data.social_links?.facebook || "";
      document.getElementById("social_twitter").value = data.social_links?.twitter || "";
      document.getElementById("social_linkedin").value = data.social_links?.linkedin || "";
      document.getElementById("social_instagram").value = data.social_links?.instagram || "";

      /* ================= IMAGES ================= */

      if (data.logo_url) {
        document.getElementById("logoPreview").innerHTML =
          `<img src="${data.logo_url}" style="max-height:80px;">`;

        document.getElementById("removeLogoBtn")?.classList.remove("hidden");
        document.getElementById("remove_logo").value = "false";
      }

      if (data.logo_print_url) {
        document.getElementById("logoPrintPreview").innerHTML =
          `<img src="${data.logo_print_url}" style="max-height:80px;">`;

        document.getElementById("removeLogoPrintBtn")?.classList.remove("hidden");
        document.getElementById("remove_logo_print").value = "false";
      }

      if (data.favicon_url) {
        document.getElementById("faviconPreview").innerHTML =
          `<img src="${data.favicon_url}" style="max-height:40px;">`;

        document.getElementById("removeFaviconBtn")?.classList.remove("hidden");
        document.getElementById("remove_favicon").value = "false";
      }

    } catch (err) {
      console.error(err);
      showToast("❌ Failed to load branding");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     📤 SUBMIT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const formData = new FormData();

    /* FILES */
    const logo = document.getElementById("logo").files[0];
    const logoPrint = document.getElementById("logo_print").files[0];
    const favicon = document.getElementById("favicon").files[0];

    if (logo) formData.append("logo", logo);
    if (logoPrint) formData.append("logo_print", logoPrint);
    if (favicon) formData.append("favicon", favicon);

    /* FLAGS (🔥 CRITICAL) */
    formData.append("remove_logo", document.getElementById("remove_logo").value);
    formData.append("remove_logo_print", document.getElementById("remove_logo_print").value);
    formData.append("remove_favicon", document.getElementById("remove_favicon").value);

    /* DATA */
    formData.append("company_name", document.getElementById("company_name").value);
    formData.append("tagline", document.getElementById("tagline").value);

    formData.append("contact[address]", document.getElementById("contact_address").value);
    formData.append("contact[phone]", document.getElementById("contact_phone").value);
    formData.append("contact[email]", document.getElementById("contact_email").value);

    formData.append("theme[primary]", document.getElementById("theme_primary").value);
    formData.append("theme[secondary]", document.getElementById("theme_secondary").value);
    formData.append("theme[surface]", document.getElementById("theme_surface").value);
    formData.append("theme[text]", document.getElementById("theme_text").value);

    formData.append("currency", document.getElementById("currency").value);
    formData.append("locale", document.getElementById("locale").value);
    formData.append("timezone", document.getElementById("timezone").value);

    formData.append("letterhead_header", document.getElementById("letterhead_header").value);
    formData.append("letterhead_footer", document.getElementById("letterhead_footer").value);

    formData.append("social_links[facebook]", document.getElementById("social_facebook").value);
    formData.append("social_links[twitter]", document.getElementById("social_twitter").value);
    formData.append("social_links[linkedin]", document.getElementById("social_linkedin").value);
    formData.append("social_links[instagram]", document.getElementById("social_instagram").value);

    formData.append(
      "status",
      document.querySelector("input[name='status']:checked")?.value || "active"
    );

    try {
      showLoading();

      const res = await authFetch("/api/organization-branding", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.message);

      showToast("✅ Branding saved");

    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚀 INIT
  ============================================================ */
  await loadBranding();
}