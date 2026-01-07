// backend/src/constants/tax.js

// Liberia-specific tax mapping (temporary until TaxRule table is ready)
export const TAX_RATES = {
  DEFAULT: 10,           // 10% fallback (use this if no specific code is given)
  GST: 10,               // Liberia Goods & Services Tax = 10%
  VAT: 10,               // Alias for GST (some people say VAT, but same rate)
  EXEMPT: 0,             // For tax-exempt services/items
  NONE: 0,               // Same as EXEMPT (non-taxable)
};

// Helper to fetch a tax rate safely
export function getTaxRate(code = "DEFAULT") {
  return TAX_RATES[code] ?? TAX_RATES.DEFAULT;
}
