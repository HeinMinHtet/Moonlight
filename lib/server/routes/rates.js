import { updateSupplierGuilds, updateRaidNoteTitles, updateBuyerPurchaseTypes, getSupplierRecordsPayload, updateSupplierServices, updateBoosterPrices, updateArmorTypes } from "../../db.js";
import { canManageAdmin, requireCsrf } from "../auth.js";
import { cleanArmorRows, cleanGuildRows, cleanPriceRows, cleanPurchaseTypeRows, cleanRaidTitleRows } from "../cleaners.js";
import { notAllowed, readJson, sendJson } from "../http.js";
import { incrementLedgerVersion } from "../ledgerVersion.js";

// Each route: match() decides whether it handles the request; handler() is the
// original handleApi branch, unchanged. Routes are tried in order.
export const ratesRoutes = [
  {
    // PUT /api/prices/supplier
    match: ({ pathname, req }) => pathname === "/api/prices/supplier" && req.method === "PUT",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change rates.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const cleaned = cleanPriceRows(body.rows, "type");
      const supplierServices = await updateSupplierServices(cleaned);
      incrementLedgerVersion();
      const { summary } = await getSupplierRecordsPayload();
      return sendJson(res, 200, { supplierServices, summary });
    }
  },
  {
    // PUT /api/prices/booster
    match: ({ pathname, req }) => pathname === "/api/prices/booster" && req.method === "PUT",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change rates.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const cleaned = cleanPriceRows(body.rows, "level");
      const boosterPrices = await updateBoosterPrices(cleaned);
      incrementLedgerVersion();
      return sendJson(res, 200, { boosterPrices });
    }
  },
  {
    // PUT /api/prices/supplier-guilds
    match: ({ pathname, req }) => pathname === "/api/prices/supplier-guilds" && req.method === "PUT",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change supplier guilds.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const cleaned = cleanGuildRows(body.rows);
      const supplierGuilds = await updateSupplierGuilds(cleaned);
      incrementLedgerVersion();
      return sendJson(res, 200, { supplierGuilds });
    }
  },
  {
    // PUT /api/prices/raid-titles
    match: ({ pathname, req }) => pathname === "/api/prices/raid-titles" && req.method === "PUT",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change raid note titles.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const cleaned = cleanRaidTitleRows(body.rows);
      const raidNoteTitles = await updateRaidNoteTitles(cleaned);
      incrementLedgerVersion();
      return sendJson(res, 200, { raidNoteTitles });
    }
  },
  {
    // PUT /api/prices/buyer-purchase-types
    match: ({ pathname, req }) => pathname === "/api/prices/buyer-purchase-types" && req.method === "PUT",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change purchase types.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const cleaned = cleanPurchaseTypeRows(body.rows);
      const buyerPurchaseTypes = await updateBuyerPurchaseTypes(cleaned);
      incrementLedgerVersion();
      return sendJson(res, 200, { buyerPurchaseTypes });
    }
  },
  {
    // PUT /api/prices/armor-types
    match: ({ pathname, req }) => pathname === "/api/prices/armor-types" && req.method === "PUT",
    handler: async ({ req, res, url, pathname, searchParams, session }) => {
      if (!canManageAdmin(session)) return notAllowed(res, "Only Discord admins can change armor stack options.");
      if (!requireCsrf(req, res, session)) return;
      const body = await readJson(req);
      const cleaned = cleanArmorRows(body.rows);
      const armorTypes = await updateArmorTypes(cleaned);
      incrementLedgerVersion();
      return sendJson(res, 200, { armorTypes });
    }
  }
];
