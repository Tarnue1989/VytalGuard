// 🔐 Auth & Session Utilities
/**
 * Validates login token & role before allowing page access.
 * - Redirects to login.html if no valid token.
 * - Redirects to 403.html if user role/permission not permitted.
 * 
 * @param {string[]|string} required - Array of permission keys OR role names, or a single permission key
 * @returns {string|null} token
 */

// ============================================================
// 🔐 Auth & Session Utilities
// ============================================================

/**
 * Validates login token & role before allowing page access.
 * - Redirects to login.html if no valid token.
 * - Redirects to 403.html if user role/permission not permitted.
 * 
 * @param {string[]|string} required - Array of permission keys OR role names, or a single permission key
 * @returns {string|null} token
 */
export function initPageGuard(required = []) {
  const token =
    localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken");
  if (!token) {
    console.warn("🚫 [initPageGuard] No token found → redirecting to login.html");
    window.location.href = "/login.html";
    return null;
  }

  // Read session + role(s)
  const userRaw =
    localStorage.getItem("userSession") || sessionStorage.getItem("userSession");
  const user = userRaw ? JSON.parse(userRaw) : null;

  // Canonical single role (legacy fallback)
  const roleStrRaw =
    localStorage.getItem("userRole") || sessionStorage.getItem("userRole") || "";
  const role = roleStrRaw.toLowerCase().trim();

  // All roles (for robust checks)
  const roleList = (user?.roles || []).map((r) =>
    String((r.normalized || r.name || r.role || "")).toLowerCase().trim()
  );

  // ✅ Elevated role detection (SUPER + ORG)
  const isSuperAdmin =
    roleList.includes("superadmin") ||
    roleList.includes("super admin") ||
    role === "superadmin" ||
    role === "super admin" ||
    (user?.email || "").toLowerCase() === "superadmin@vytalguard.com";

  const isOrgAdmin =
    roleList.includes("organization admin") ||
    roleList.includes("organization_admin") ||
    roleList.includes("org admin") ||
    roleList.includes("org_admin") ||
    roleList.includes("org owner") ||
    roleList.includes("org_owner") ||
    roleList.includes("organization owner") ||
    roleList.includes("organization_owner");


  console.groupCollapsed("🔐 [initPageGuard] Session Snapshot");
  console.log("Required →", required);
  console.log("Token →", token ? "✅ Present" : "❌ Missing");
  console.log("User →", user);
  console.log("Role →", role);
  console.log("Role List →", roleList);
  console.log("Is Super Admin →", isSuperAdmin);
  console.groupEnd();

  if (isSuperAdmin) {
    console.info("✅ [initPageGuard] Super Admin bypass granted");
    document.body.classList.remove("hidden");
    return token;
  }

  // ---- Permissions check ----
  let permsRaw = [];
  try {
    const rawPerms = localStorage.getItem("permissions") || "[]";
    permsRaw = JSON.parse(rawPerms);
  } catch {
    permsRaw = [];
  }

  // 🔽 Normalize everything into flat lowercase array
  let normalizedPerms = [];
  if (Array.isArray(permsRaw)) {
    if (typeof permsRaw[0] === "string") {
      normalizedPerms = permsRaw.map((p) => String(p).toLowerCase().trim());
    } else if (typeof permsRaw[0] === "object") {
      normalizedPerms = permsRaw
        .filter((p) => p && p.enabled !== false)
        .flatMap((p) =>
          [p.module_key, p.key, p.name]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase().trim())
        );
    }
  } else if (permsRaw && typeof permsRaw === "object") {
    normalizedPerms = Object.keys(permsRaw)
      .filter((k) => permsRaw[k])
      .map((k) => String(k).toLowerCase().trim());
  }

  const hasPermissionKey = (key) => {
    if (!key) return true;
    const normalizedKey = String(key).toLowerCase().trim();
    const found = normalizedPerms.includes(normalizedKey);
    console.debug(
      `🔎 Checking permission → "${normalizedKey}" → ${
        found ? "✅ ALLOWED" : "❌ DENIED"
      }`
    );
    return found;
  };

  // ---- Evaluate requirement ----
  let authorized = true;
  let reason = "none";

  if (typeof required === "string") {
    authorized = hasPermissionKey(required);
    if (!authorized) reason = `missing permission "${required}"`;
  } else if (Array.isArray(required) && required.length) {
    const normalizedReq = required.map((r) => String(r).toLowerCase().trim());
    const hasAnyPermission = normalizedReq.some((r) => hasPermissionKey(r));
    const hasRoleMatch = normalizedReq.some(
      (r) => roleList.includes(r) || role === r
    );
    authorized = hasAnyPermission || hasRoleMatch;
    if (!authorized)
      reason = `no match for [${normalizedReq.join(", ")}] in perms or roles`;
  }

  console.groupCollapsed("🔐 [initPageGuard RESULT]");
  console.log("Required Keys →", required);
  console.log("Normalized Permissions →", normalizedPerms);
  console.log("Authorized →", authorized);
  if (!authorized) console.warn("🚫 Reason →", reason);
  console.groupEnd();

  if (!authorized) {
    console.warn("🚫 [initPageGuard] Redirecting to /403.html in 3 seconds...");
    // Wait a few seconds before redirect so you can read console logs
    setTimeout(() => {
      window.location.href = "/403.html";
    }, 3000);
    debugger; // ⏸️ pause JS execution if DevTools is open
    return null;
  }

  // 🎉 Authorized
  console.info("✅ [initPageGuard] Access granted");
  document.body.classList.remove("hidden");
  return token;
}

// ============================================================
// 🧠 Auto Page Permission Helper
// ============================================================
/**
/**
 * 🧠 Automatically detect correct permission key(s) based on page name.
 * Example:
 *   add-appointment.html     → appointments:create
 *   edit-appointment.html    → appointments:edit
 *   appointments-list.html   → appointments:view
 *   verify-labtest.html      → labtests:verify
 */
export function autoPagePermissionKey() {
  const path = window.location.pathname.split("/").pop() || "";
  const baseName = path.replace(".html", "").trim().toLowerCase();

  // 🧠 Extract module name correctly (handles both prefix and suffix patterns)
  let moduleKey = baseName;
  const prefixMatch =
    baseName.match(/^(add|edit|view|verify|approve|list)-(.+)$/) ||
    baseName.match(/^(.+?)-(list|main|filter)$/);

  if (prefixMatch) {
    // Determine which regex matched
    if (/^(add|edit|view|verify|approve|list)-/.test(baseName)) {
      moduleKey = prefixMatch[2]; // first regex → capture after prefix
    } else {
      moduleKey = prefixMatch[1]; // second regex → capture before suffix
    }
  } else {
    moduleKey = baseName.split("-")[0];
  }

  // ✅ Normalize module naming (for underscore-based permission keys)
  moduleKey = moduleKey
    .replace(/-/g, "_")
    .replace(/centralstock/, "central_stock")
    .replace(/billableitem/, "billable_item")
    .replace(/autobillingrule/, "auto_billing_rule")
    .replace(/labtest/, "lab_test")
    .replace(/purchaseorder/, "purchase_order")
    .replace(/paymenttransaction/, "payment_transaction")
    .replace(/deliveryrecord/, "delivery_record")
    .replace(/deliveryrecords/, "delivery_records")
    .replace(/stockrequest/, "stock_request")
    .toLowerCase();

  // ✅ Smart pluralization engine (covers common English cases safely)
  if (moduleKey.endsWith("y")) {
    // category → categories, facility → facilities
    moduleKey = moduleKey.slice(0, -1) + "ies";
  } else if (moduleKey.endsWith("sis")) {
    // analysis → analyses, diagnosis → diagnoses
    moduleKey = moduleKey.slice(0, -3) + "ses";
  } else if (moduleKey.endsWith("ex") || moduleKey.endsWith("ix")) {
    // index → indices, appendix → appendices
    moduleKey = moduleKey.slice(0, -2) + "ices";
  } else if (moduleKey.endsWith("us")) {
    // focus → foci (rare)
    moduleKey = moduleKey.slice(0, -2) + "i";
  } else if (!moduleKey.endsWith("s")) {
    // Default plural: add "s"
    moduleKey += "s";
  }

  // 🔧 Detect action
  let action = "view";
  if (baseName.startsWith("add-")) action = "create";
  else if (baseName.startsWith("edit-")) action = "edit";
  else if (baseName.startsWith("approve-")) action = "approve";
  else if (baseName.startsWith("verify-")) action = "verify";

  const permissionKey = `${moduleKey}:${action}`;
  console.log(`🧩 [autoPagePermissionKey] → ${permissionKey}`);

  // 🔁 Dual-mode Add/Edit allowed
  if (action === "create" || action === "edit") {
    return [`${moduleKey}:create`, `${moduleKey}:edit`];
  }

  return permissionKey;
}


// ============================================================
// 🌐 Global Logout Watcher
// ============================================================
export function initLogoutWatcher() {
  window.addEventListener("storage", (event) => {
    if (event.key === "accessToken" && !event.newValue) {
      window.location.href = "/login.html";
    }
  });
}

// ============================================================
// 🧰 General Storage Utilities
// ============================================================
export function getStoredItem(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch (err) {
    console.warn(`Storage access error for key "${key}":`, err);
    return null;
  }
}

// ============================================================
// 📦 Paginated Cache Utilities
// ============================================================

/**
 * 🔁 Loads paginated data with optional caching and TTL expiration.
 * @param {string} cacheKeyPrefix - The prefix for the localStorage key.
 * @param {number} page - Current page number.
 * @param {Function} fetchFunc - A function that returns the paginated data.
 * @param {boolean} forceRefresh - If true, bypass cache and reload from server.
 * @param {number} ttlMs - How long (in ms) to keep cache valid. Default 5 min.
 * @returns {Promise<Object>} - The paginated result data.
 */
export async function loadPaginatedWithCache(
  cacheKeyPrefix,
  page,
  fetchFunc,
  forceRefresh = false,
  ttlMs = 300000
) {
  const key = `${cacheKeyPrefix}_page_${page}`;

  if (!forceRefresh) {
    const cachedStr = localStorage.getItem(key);
    if (cachedStr) {
      try {
        const cachedObj = JSON.parse(cachedStr);
        if (cachedObj._timestamp && cachedObj.data) {
          const age = Date.now() - cachedObj._timestamp;
          if (age < ttlMs) {
            console.log(
              `✅ [CACHE HIT] ${cacheKeyPrefix} page ${page} (age ${age} ms)`
            );
            return cachedObj.data;
          } else {
            console.log(
              `⚠️ [CACHE EXPIRED] ${cacheKeyPrefix} page ${page} (age ${age} ms)`
            );
          }
        } else {
          console.log(
            `✅ [CACHE HIT - Legacy] ${cacheKeyPrefix} page ${page}`
          );
          return cachedObj;
        }
      } catch (err) {
        console.warn(`⚠️ Failed to parse cache for ${key}:`, err);
      }
    }
  }

  console.log(`🔄 [FETCH] ${cacheKeyPrefix} page ${page}`);
  const result = await fetchFunc(page);

  if (result?.data) {
    localStorage.setItem(
      key,
      JSON.stringify({
        _timestamp: Date.now(),
        data: result,
      })
    );
  }

  return result;
}

/**
 * 🧹 Clear all cached entries for a given cache key prefix.
 * Useful when doing full updates/deletes and want to flush old cached pages.
 * @param {string} prefix - For example: "users_"
 */
export function clearPaginatedCache(prefix) {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed cache key: ${key}`);
    }
  });
}
