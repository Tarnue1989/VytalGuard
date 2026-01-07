export function getUserRole() {
  const role =
    localStorage.getItem("userRole") ||
    sessionStorage.getItem("userRole") ||
    "viewer";

  return role.toLowerCase().trim();
}
