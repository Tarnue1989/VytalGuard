// 📁 feature-module-constants.js – Enterprise Master Pattern
// ============================================================================
// 🧭 Mirrors patient-constants.js EXACTLY (structure + intent)
// 🔹 Aligned with FeatureModule model + API payload
// 🔹 UI-safe (NO raw UUIDs rendered)
// 🔹 Safe for list, export, card, detail, summary, sorting
// ============================================================================

/* ============================================================
   📋 Field Labels (Enterprise Aligned)
============================================================ */
export const FIELD_LABELS_FEATURE_MODULE = {
  // 🧩 Core Identity
  name: "Module Name",
  key: "Key",
  icon: "Icon",
  category: "Category",
  description: "Description",
  tags: "Tags",

  // 🔐 Access & Scope
  roles: "Roles With Access",
  visibility: "Visibility",
  tenant_scope: "Tenant Scope",
  enabled: "Enabled",
  status: "Status",

  // 🧭 Navigation & Hierarchy
  order_index: "Menu Order",
  route: "Route",
  parent_id: "Parent Module",
  children: "Child Modules",

  // 📊 Dashboard
  show_on_dashboard: "Show on Dashboard",
  dashboard_type: "Dashboard Type",
  dashboard_order: "Dashboard Order",

  // 👤 Audit (UI-safe associations)
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚙️ System
  actions: "Actions",
};

/* ============================================================
   📋 Field Display Order (Table / Export / Detail)
============================================================ */
export const FIELD_ORDER_FEATURE_MODULE = [
  // 🧩 Core Identity
  "name",
  "key",
  "icon",
  "category",
  "description",
  "tags",

  // 🔐 Access & Scope
  "roles",
  "visibility",
  "tenant_scope",
  "enabled",
  "status",

  // 🧭 Navigation & Hierarchy
  "order_index",
  "route",
  "parent_id",
  "children",

  // 📊 Dashboard
  "show_on_dashboard",
  "dashboard_type",
  "dashboard_order",

  // 🧾 Audit
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  // ⚙️ System
  "actions",
];

/* ============================================================
   👥 Role-Based Default Field Sets
============================================================ */
export const FIELD_DEFAULTS_FEATURE_MODULE = {
  superadmin: [
    // 🧩 Identity
    "name",
    "key",
    "icon",
    "category",
    "description",
    "tags",

    // 🔐 Scope
    "roles",
    "visibility",
    "tenant_scope",
    "enabled",
    "status",

    // 🧭 Navigation
    "order_index",
    "route",
    "parent_id",
    "children",

    // 📊 Dashboard
    "show_on_dashboard",
    "dashboard_type",
    "dashboard_order",

    // 🧾 Audit
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",

    "actions",
  ],

  admin: [
    "name",
    "key",
    "icon",
    "category",
    "description",
    "tags",

    "roles",
    "visibility",
    "tenant_scope",
    "enabled",
    "status",

    "order_index",
    "route",
    "parent_id",
    "children",

    "show_on_dashboard",
    "dashboard_type",
    "dashboard_order",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "actions",
  ],

  manager: [
    "name",
    "key",
    "category",
    "description",

    "visibility",
    "tenant_scope",
    "enabled",
    "status",

    "order_index",
    "route",
    "parent_id",

    "show_on_dashboard",
    "dashboard_type",
    "dashboard_order",

    "createdBy",
    "created_at",

    "actions",
  ],

  staff: [
    "name",
    "category",
    "status",
  ],
};
