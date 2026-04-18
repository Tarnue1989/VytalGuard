// ======================================================
// 📘 VYTALGUARD MANUAL CONTROLLER — PREMIUM UPGRADE
// ======================================================

document.addEventListener("DOMContentLoaded", function () {
  initTabs();
  initToggleSections();
  initSearch();
  initDefaultState();
});

/* =====================================================
   🔀 TAB SYSTEM (WITH SMOOTH UX)
===================================================== */
function initTabs() {
  const tabs = document.querySelectorAll("[data-tab]");
  const sections = document.querySelectorAll(".doc-section");

  if (!tabs.length || !sections.length) {
    console.warn("Manual: Tabs or sections not found");
    return;
  }

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const target = btn.getAttribute("data-tab");

      // ACTIVE TAB
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // HIDE ALL
      sections.forEach((sec) => {
        sec.classList.add("d-none");
      });

      // SHOW TARGET
      const targetEl = document.getElementById(target);
      if (targetEl) {
        targetEl.classList.remove("d-none");
      }

      // 🔥 PREMIUM: SCROLL TO TOP
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

/* =====================================================
   📂 COLLAPSIBLE CARDS (NEW)
===================================================== */
function initToggleSections() {
  const cards = document.querySelectorAll(".doc-card");

  cards.forEach((card) => {
    const header = card.querySelector("h6");

    if (!header) return;

    header.style.cursor = "pointer";

    header.addEventListener("click", () => {
      const content = Array.from(card.children).slice(1);

      content.forEach((el) => {
        el.classList.toggle("d-none");
      });

      card.classList.toggle("collapsed");
    });
  });
}

/* =====================================================
   🔍 SEARCH SYSTEM (REAL WORKING SEARCH)
===================================================== */
function initSearch() {
  const input = document.getElementById("docSearch");
  if (!input) return;

  const sections = document.querySelectorAll(".doc-section");
  const tabs = document.querySelectorAll("[data-tab]");

  input.addEventListener("input", function () {
    const keyword = input.value.toLowerCase().trim();

    let anyMatch = false;

    sections.forEach((section) => {
      const cards = section.querySelectorAll(".doc-card");
      let sectionMatch = false;

      cards.forEach((card) => {
        const text = card.innerText.toLowerCase();
        const match = text.includes(keyword);

        card.style.display = match ? "" : "none";

        if (match) sectionMatch = true;
      });

      // SHOW section only if it has match
      section.classList.toggle("d-none", !sectionMatch && keyword !== "");

      if (sectionMatch) anyMatch = true;
    });

    // 🔥 AUTO SWITCH TAB TO FIRST MATCH
    if (keyword !== "") {
      sections.forEach((section) => {
        if (!section.classList.contains("d-none")) {
          tabs.forEach((t) => t.classList.remove("active"));

          const id = section.id;
          const activeTab = document.querySelector(`[data-tab="${id}"]`);
          if (activeTab) activeTab.classList.add("active");

          return;
        }
      });
    }

    // RESET WHEN EMPTY
    if (keyword === "") {
      sections.forEach((sec) => {
        sec.classList.add("d-none");
        sec.querySelectorAll(".doc-card").forEach(c => c.style.display = "");
      });

      const firstTab = document.querySelector(".doc-tabs button");
      if (firstTab) firstTab.click();
    }
  });
}

/* =====================================================
   🎯 DEFAULT STATE (SAFE INIT)
===================================================== */
function initDefaultState() {
  const firstTab = document.querySelector(".doc-tabs button");
  const sections = document.querySelectorAll(".doc-section");

  if (!firstTab || !sections.length) return;

  sections.forEach((sec) => sec.classList.add("d-none"));

  const firstTarget = firstTab.getAttribute("data-tab");
  const firstSection = document.getElementById(firstTarget);

  if (firstSection) {
    firstSection.classList.remove("d-none");
  }

  firstTab.classList.add("active");
}

/* =====================================================
   ⚡ OPTIONAL: GLOBAL FILTER FUNCTION (KEEP)
===================================================== */
function filterDocs(keyword) {
  const cards = document.querySelectorAll(".doc-card");

  keyword = keyword.toLowerCase();

  cards.forEach((card) => {
    const text = card.innerText.toLowerCase();
    const match = text.includes(keyword);

    card.style.display = match ? "" : "none";
  });
}

/* =====================================================
   🧪 DEBUG
===================================================== */
console.log("📘 VytalGuard Manual — Premium Loaded");



// ======================================================
// 🔙 MANUAL BACK BUTTON (FINAL SAFE VERSION)
// ======================================================
window.goToDashboard = function () {
  // If there is real browser history
  if (window.history.length > 1) {
    window.history.back();
  } else {
    // fallback if opened directly or refreshed
    window.location.href = "/dashboard.html";
  }
};