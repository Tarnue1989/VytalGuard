export function getCurrencySymbol(c) {
  if (c === "USD") return "$";
  if (c === "LRD") return "L$";
  return c || "";
}