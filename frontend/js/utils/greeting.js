/* ============================================================
   🌤️ ENTERPRISE GREETING ENGINE (GLOBAL REUSABLE)
============================================================ */

export function getGreetingMeta(user = {}) {
  const hour = new Date().getHours();

  let greeting = "Hello";
  let icon = "ri-sun-line";
  let theme = "primary";

  if (hour < 12) {
    greeting = "Good Morning";
    icon = "ri-sun-line";
    theme = "warning";
  } else if (hour < 17) {
    greeting = "Good Afternoon";
    icon = "ri-sun-cloudy-line";
    theme = "info";
  } else {
    greeting = "Good Evening";
    icon = "ri-moon-line";
    theme = "dark";
  }

  /* 🔹 ROLE AWARE */
  const role = (user.role || "").toLowerCase();

  let roleLabel = "";
  if (role.includes("doctor")) roleLabel = "Doctor";
  else if (role.includes("admin")) roleLabel = "Admin";
  else if (role.includes("nurse")) roleLabel = "Nurse";
  else if (role.includes("super")) roleLabel = "Administrator";

  return {
    text: greeting,
    icon,
    theme,
    roleLabel
  };
}