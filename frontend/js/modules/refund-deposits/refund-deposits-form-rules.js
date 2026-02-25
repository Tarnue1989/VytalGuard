/* =============================================
   Deposit Refund Form Rules (Controller-aligned)
   MASTER PARITY (Deposit / Refund Pattern)
   ▸ Tenant inherited strictly from Deposit
   ▸ NO organization / facility validation
============================================= */

export const REFUND_DEPOSIT_FORM_RULES = [
  // ================= Identity =================
  {
    id: "patientInput",
    message: "Patient is required",
  },
  {
    id: "depositInput",
    message: "Deposit is required",
  },
  {
    id: "refund_amount",
    message: "Refund amount is required",
  },
  {
    id: "methodSelect",
    message: "Refund method is required",
  },
  {
    id: "reason",
    message: "Reason is required",
  },
];
