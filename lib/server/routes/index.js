import { sessionRoutes } from "./session.js";
import { supplierRoutes } from "./supplier.js";
import { profitRoutes } from "./profit.js";
import { boosterRoutes } from "./booster.js";
import { ratesRoutes } from "./rates.js";
import { expensesRoutes } from "./expenses.js";
import { raidNotesRoutes } from "./raidNotes.js";

// Every /api/* route, grouped by domain. handleApi() in server.js tries them in this order.
export const apiRoutes = [
  ...sessionRoutes,
  ...supplierRoutes,
  ...profitRoutes,
  ...boosterRoutes,
  ...ratesRoutes,
  ...expensesRoutes,
  ...raidNotesRoutes
];
