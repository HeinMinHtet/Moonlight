import { validIsoDate } from "../../profitReport.js";
import { getProfitReportData } from "../../db.js";
import { canManageAdmin } from "../auth.js";
import { notAllowed, sendJson } from "../http.js";

// Each route: match() decides whether it handles the request; handler() is the
// original handleApi branch, unchanged. Routes are tried in order.
export const profitRoutes = [
  {
    // GET /api/profit-report
    match: ({ pathname, req }) => pathname === "/api/profit-report" && req.method === "GET",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can view profit reporting.");
      const from = searchParams.get("from") || "";
      const to = searchParams.get("to") || "";
      const groupBy = searchParams.get("groupBy") || "weekly";
      if (!validIsoDate(from) || !validIsoDate(to)) return sendJson(res, 400, { error: "Choose a valid profit report date range." });
      if (from > to) return sendJson(res, 400, { error: "Profit report start date must be before the end date." });
      if (!["weekly", "monthly", "daily"].includes(groupBy)) return sendJson(res, 400, { error: "Profit reports can be grouped weekly or monthly." });
      const report = await getProfitReportData(from, to, groupBy);
      return sendJson(res, 200, report);
    }
  }
];
