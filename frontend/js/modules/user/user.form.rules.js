export const USER_FORM_RULES = [
  { id: "username", message: "Username is required" },
  { id: "email", message: "Email is required" },

  {
    id: "password",
    message: "Password is required",
    when: () => !sessionStorage.getItem("userEditId"),
  },

  { id: "status", message: "Status is required", when: () => true },

  {
    id: "organization_id",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  {
    id: "role_id",
    message: "Role is required",
    when: () => true,
  },

  {
    id: "facility_id",
    message: "Facility is required for selected role",
    when: () => {
      const selected = document.getElementById("role_id");
      if (!selected) return false;

      const option = selected.options[selected.selectedIndex];
      return option?.dataset.requiresFacility === "true";
    },
  },
];