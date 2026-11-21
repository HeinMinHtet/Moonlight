import { buildProfitReport } from "../profitReport.js";
import { getPool, isPostgres, mapBoosterAdjustmentFromRow, mapBoosterRecordFromRow, mapExternalExpenseFromRow, mapSupplierRecordFromRow, readFileDb } from "./core.js";

export async function getProfitReportData(from, to, groupBy) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const fromBoundary = `${from}T00:00:00+07:00`;
      const toBoundary = `${to}T23:59:59.999+07:00`;
      const [supplierRes, boosterRes, expenseRes, adjRes] = await Promise.all([
        client.query(
          "SELECT * FROM supplier_records WHERE paid = true AND ((paid_at IS NOT NULL AND paid_at >= $1::timestamptz AND paid_at <= $2::timestamptz) OR (paid_at IS NULL AND date >= $3 AND date <= $4))",
          [fromBoundary, toBoundary, from, to]
        ),
        client.query(
          "SELECT * FROM booster_records WHERE paid = true AND ((paid_at IS NOT NULL AND paid_at >= $1::timestamptz AND paid_at <= $2::timestamptz) OR (paid_at IS NULL AND created_at >= $1::timestamptz AND created_at <= $2::timestamptz))",
          [fromBoundary, toBoundary]
        ),
        client.query(
          "SELECT * FROM external_expenses WHERE date >= $1 AND date <= $2",
          [from, to]
        ),
        client.query(
          "SELECT * FROM booster_adjustments WHERE settled = true AND ((settled_at IS NOT NULL AND settled_at >= $1::timestamptz AND settled_at <= $2::timestamptz) OR (settled_at IS NULL AND date >= $3 AND date <= $4))",
          [fromBoundary, toBoundary, from, to]
        )
      ]);
      const db = {
        supplierRecords: supplierRes.rows.map(mapSupplierRecordFromRow),
        boosterRecords: boosterRes.rows.map(mapBoosterRecordFromRow),
        externalExpenses: expenseRes.rows.map(mapExternalExpenseFromRow),
        boosterAdjustments: adjRes.rows.map(mapBoosterAdjustmentFromRow)
      };
      return buildProfitReport(db, from, to, groupBy);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return buildProfitReport(db, from, to, groupBy);
  }
}
