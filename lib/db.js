// Data access layer, split by domain under lib/db/. This file re-exports the same public
// API it always had, so existing imports of "./lib/db.js" keep working unchanged.
export { getDbPath, defaultDb, isPostgres, getPool, lineTotal, paymentBatchIdFor, supplierSummary, boosterSummary, writeFileAtomic, externalExpensesSummary } from "./db/core.js";
export { initDb } from "./db/schema.js";
export { getConfig, getSupplierRate, getBoosterRate, getSupplierServicesList, getBoosterPricesList, getArmorTypesList, updateArmorTypes, getSupplierGuildsList, updateSupplierGuilds, updateRaidNoteTitles, updateBuyerPurchaseTypes, updateSupplierServices, updateBoosterPrices } from "./db/rates.js";
export { getSupplierRecordsPayload, insertSupplierRecord, updateSupplierRecord, deleteSupplierRecord, verifyAllSupplierRecords, unverifyAllSupplierRecords, markSupplierRecordsPaid, reopenSupplierPaymentBatch } from "./db/supplierRecords.js";
export { getSupplierWithdrawalsPayload, insertSupplierWithdrawal, getSupplierWithdrawalById, updateSupplierWithdrawal, deleteSupplierWithdrawal } from "./db/supplierWithdrawals.js";
export { getBoosterRecordsPayload, insertBoosterRecord, getBoosterRecordById, updateBoosterRecord, deleteBoosterRecord, markBoosterRecordsPaid } from "./db/boosterRecords.js";
export { getBoosterAdjustmentsPayload, insertBoosterAdjustment, getBoosterAdjustmentById, updateBoosterAdjustment, deleteBoosterAdjustment } from "./db/boosterAdjustments.js";
export { getBoosterCashVaultPayload, insertBoosterVaultTransaction, withdrawBoosterVaultCash, settleBoosterBalance } from "./db/boosterVault.js";
export { getProfitReportData } from "./db/profit.js";
export { getSessionFromDb, saveSessionToDb, recordUserLogin, deleteSessionFromDb, pruneExpiredSessions } from "./db/sessions.js";
export { getExternalExpensesPayload, insertExternalExpense, getExternalExpenseById, updateExternalExpense, deleteExternalExpense } from "./db/expenses.js";
export { getRaidNotesPayload, insertRaidNote, getRaidNoteById, updateRaidNote, deleteRaidNote } from "./db/raidNotes.js";
