/* ============================================================
   🔙 GLOBAL BACK TO MODULES HANDLER (AUTO)
============================================================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#backToModulesBtn");
  if (!btn) return;

  sessionStorage.setItem("openDashboardTab", "modules");
  window.location.href = "/dashboard.html";
});

/* ============================================================
   🧩 AUTO-INJECT INTO HEADERS
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".card-header").forEach((header) => {
    // skip if already exists
    if (header.querySelector("#backToModulesBtn")) return;

    // skip if no title (safe guard)
    const title = header.querySelector(".card-title");
    if (!title) return;

    // find or create right side container
    let actionWrapper = header.querySelector(".d-flex.ms-auto");

    if (!actionWrapper) {
      actionWrapper = document.createElement("div");
      actionWrapper.className = "d-flex gap-2 ms-auto";
      header.appendChild(actionWrapper);
    }

    // create button
    const btn = document.createElement("button");
    btn.id = "backToModulesBtn";
    btn.className = "btn btn-outline-secondary btn-sm";
    btn.innerHTML = `<i class="ri-arrow-left-line me-1"></i> Work Area`;

    // add BEFORE other buttons
    actionWrapper.prepend(btn);
  });
});