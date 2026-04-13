// 📁 backend/src/controllers/financialReportController.js
import { financialReportService } from "../services/financialReportService.js";

/* ============================================================
   🧠 Helper — normalize single date to ISO (YYYY-MM-DD)
============================================================ */
function normalizeDate(input) {
  if (!input) return null;

  // Already ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  // MM/DD/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
    const [mm, dd, yyyy] = input.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback
  const d = new Date(input);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/* ============================================================
   🧠 Helper — normalize & validate date range
============================================================ */
function resolveDateRange(query) {
  let { from, to } = query;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  from = normalizeDate(from);
  to = normalizeDate(to);

  // Default: first day of month
  if (!from) {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    from = firstDay.toISOString().slice(0, 10);
  }

  // Default: today
  if (!to) {
    to = today.toISOString().slice(0, 10);
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    const err = new Error("Invalid date format. Use YYYY-MM-DD.");
    err.status = 400;
    throw err;
  }

  if (fromDate > toDate) {
    const err = new Error("Invalid date range: 'from' cannot be after 'to'.");
    err.status = 400;
    throw err;
  }

  return { from, to };
}

/* ============================================================
   📊 FINANCIAL REPORT CONTROLLER (FINAL)
============================================================ */
export const financialReportController = {

  /* ============================================================
     🔹 SUMMARY
  ============================================================ */
  async summary(req, res, next) {
    try {
      const { from, to } = resolveDateRange(req.query);

      const organization_id = req.user.organization_id;
      const facility_id =
        req.query.facility_id || req.user.facility_id;

      const data = await financialReportService.getSummary({
        from,
        to,
        organization_id,
        facility_id,
      });

      res.json({ success: true, data, from, to });
    } catch (err) {
      next(err);
    }
  },

  /* ============================================================
     🔹 SERVICE BREAKDOWN
  ============================================================ */
  async services(req, res, next) {
    try {
      const { from, to } = resolveDateRange(req.query);

      const organization_id = req.user.organization_id;
      const facility_id =
        req.query.facility_id || req.user.facility_id;

      const data = await financialReportService.getServiceBreakdown({
        from,
        to,
        organization_id,
        facility_id,
      });

      res.json({ success: true, data, from, to });
    } catch (err) {
      next(err);
    }
  },

  /* ============================================================
     🔹 PAYMENTS
  ============================================================ */
  async payments(req, res, next) {
    try {
      const { from, to } = resolveDateRange(req.query);

      const organization_id = req.user.organization_id;
      const facility_id =
        req.query.facility_id || req.user.facility_id;

      const data = await financialReportService.getPaymentsByMethod({
        from,
        to,
        organization_id,
        facility_id,
      });

      res.json({ success: true, data, from, to });
    } catch (err) {
      next(err);
    }
  },

  /* ============================================================
     🔹 PAYMENT REFUNDS
  ============================================================ */
  async paymentRefunds(req, res, next) {
    try {
      const { from, to } = resolveDateRange(req.query);

      const organization_id = req.user.organization_id;
      const facility_id =
        req.query.facility_id || req.user.facility_id;

      const data = await financialReportService.getPaymentRefunds({
        from,
        to,
        organization_id,
        facility_id,
      });

      res.json({
        success: true,
        refund_scope: "payment",
        data,
        from,
        to,
      });
    } catch (err) {
      next(err);
    }
  },

  /* ============================================================
     🔹 DEPOSITS
  ============================================================ */
  async deposits(req, res, next) {
    try {
      const { from, to } = resolveDateRange(req.query);

      const organization_id = req.user.organization_id;
      const facility_id =
        req.query.facility_id || req.user.facility_id;

      const data = await financialReportService.getDeposits({
        from,
        to,
        organization_id,
        facility_id,
      });

      res.json({ success: true, data, from, to });
    } catch (err) {
      next(err);
    }
  },

};