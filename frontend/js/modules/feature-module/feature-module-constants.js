// 🧩 Feature Module Field Labels (UI-SAFE, NO UUIDS)

export const FIELD_LABELS_FEATURE_MODULE = {
  name: "Module Name",
  key: "Key",
  icon: "Icon",
  category: "Category",
  roles: "Roles With Access",
  description: "Description",
  tags: "Tags",

  visibility: "Visibility",
  tenant_scope: "Tenant Scope",
  enabled: "Enabled",
  status: "Status",

  order_index: "Menu Order",
  route: "Route",
  parent_id: "Parent Module",
  children: "Child Modules",

  show_on_dashboard: "Show on Dashboard",
  dashboard_type: "Dashboard Type",
  dashboard_order: "Dashboard Order",

  // 👤 User associations (NO raw IDs)
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  actions: "Actions",
};


/* ============================================================
   📐 FIELD ORDER (Table / Export / Column Selector)
   ============================================================ */
export const FIELD_ORDER_FEATURE_MODULE = [
  "name",
  "key",
  "icon",
  "category",
  "roles",
  "description",
  "tags",

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
  "deletedBy",
  "deleted_at",

  "actions",
];


/* ============================================================
   🎛️ ROLE-BASED DEFAULT VISIBLE FIELDS
   ============================================================ */
export const FIELD_DEFAULTS_FEATURE_MODULE = {
  superadmin: [
    "name","key","icon","category","roles","description","tags",
    "visibility","tenant_scope","enabled","status",
    "order_index","route","parent_id","children",
    "show_on_dashboard","dashboard_type","dashboard_order",
    "createdBy","created_at","updatedBy","updated_at","deletedBy","deleted_at",
    "actions",
  ],

  admin: [
    "name","key","icon","category","roles","description","tags",
    "visibility","tenant_scope","enabled","status",
    "order_index","route","parent_id","children",
    "show_on_dashboard","dashboard_type","dashboard_order",
    "createdBy","created_at","updatedBy","updated_at",
    "actions",
  ],

  manager: [
    "name","key","category","roles","description",
    "visibility","tenant_scope","enabled","status",
    "order_index","route","parent_id",
    "show_on_dashboard","dashboard_type","dashboard_order",
    "createdBy","created_at","updatedBy","updated_at",
    "actions",
  ],

  staff: [
    "name",
    "category",
    "status",
  ],
};
