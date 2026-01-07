// 🧩 User Field Labels
export const FIELD_LABELS_USER = {
  username: "Username",
  email: "Email",
  first_name: "First Name",
  last_name: "Last Name",
  full_name: "Full Name",
  status: "Status",
  last_login_at: "Last Login",
  locked_until: "Locked Until",

  // 🔗 Relations
  organization: "Organization",   // ✅ added
  facilities: "Facilities",
  roles: "Roles",

  // 🕵️ Audit relations
  createdByUser: "Created By",
  updatedByUser: "Updated By",
  deletedByUser: "Deleted By",

  // 🗓️ Timestamps
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚡ UI
  actions: "Actions"
};

// 🧩 Field Order
export const FIELD_ORDER_USER = [
  "username", "email", "first_name", "last_name", "full_name",
  "status", "last_login_at", "locked_until",
  "organization",   // ✅ added
  "facilities", "roles",
  "createdByUser", "created_at",
  "updatedByUser", "updated_at",
  "deletedByUser", "deleted_at",
  "actions"
];

// 🧩 Role-Based Defaults
export const FIELD_DEFAULTS_USER = {
  superadmin: [
    "username", "email", "first_name", "last_name", "full_name",
    "status", "last_login_at", "locked_until",
    "organization",   // ✅ added
    "facilities", "roles",
    "createdByUser", "created_at",
    "updatedByUser", "updated_at",
    "deletedByUser", "deleted_at",
    "actions"
  ],
  admin: [
    "username", "email", "first_name", "last_name", "full_name",
    "status", "last_login_at", "locked_until",
    "facilities", "roles",   // org admins normally scoped to their org, so no org col
    "createdByUser", "created_at",
    "updatedByUser", "updated_at",
    "actions"
  ],
  manager: [
    "username", "email", "full_name",
    "status", "last_login_at", "locked_until",
    "facilities", "roles",
    "createdByUser", "created_at",
    "updatedByUser", "updated_at",
    "actions"
  ],
  staff: [
    "username", "email", "status", "actions"
  ]
};
