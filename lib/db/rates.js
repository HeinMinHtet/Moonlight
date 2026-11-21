import { getPool, isPostgres, normalizeArmorType, readFileDb, writeFileDb } from "./core.js";

// -------------------------------------------------------------
// Unified Database Access Layer (Postgres + File Fallback)
// -------------------------------------------------------------

export async function getConfig(session, permissions) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const [servicesRes, boosterRes, armorRes, guildsRes, raidTitlesRes, purchaseTypesRes] = await Promise.all([
        client.query("SELECT type, price, active, is_default FROM supplier_services ORDER BY id ASC"),
        client.query("SELECT level, price, active, is_default FROM booster_prices ORDER BY id ASC"),
        client.query("SELECT name, active, is_default FROM armor_types ORDER BY id ASC"),
        client.query("SELECT name, active, is_default FROM supplier_guilds ORDER BY id ASC"),
        client.query("SELECT name, active, is_default FROM raid_note_titles ORDER BY id ASC"),
        client.query("SELECT name, active, is_default FROM buyer_purchase_types ORDER BY id ASC")
      ]);

      const supplierServices = servicesRes.rows.map((row) => ({
        type: row.type,
        price: Number(row.price),
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const boosterPrices = boosterRes.rows.map((row) => ({
        level: row.level,
        price: Number(row.price),
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const armorTypes = armorRes.rows.map((row) => ({
        name: row.name,
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const supplierGuilds = guildsRes.rows.map((row) => ({
        name: row.name,
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const raidNoteTitles = raidTitlesRes.rows.map((row) => ({
        name: row.name,
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      const buyerPurchaseTypes = purchaseTypesRes.rows.map((row) => ({
        name: row.name,
        active: Boolean(row.active),
        isDefault: Boolean(row.is_default)
      }));

      return {
        supplierServices: permissions.supplierRecords ? supplierServices : [],
        boosterPrices: permissions.priceSettings
          ? boosterPrices
          : boosterPrices.filter((row) => row.active !== false).map(({ level, isDefault }) => ({ level, price: 0, active: true, isDefault: Boolean(isDefault) })),
        armorTypes,
        supplierGuilds: permissions.supplierRecords || permissions.priceSettings ? supplierGuilds : [],
        raidNoteTitles: permissions.priceSettings || permissions.raidNotes ? raidNoteTitles : [],
        buyerPurchaseTypes: permissions.priceSettings || permissions.raidNotes ? buyerPurchaseTypes : []
      };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return {
      supplierServices: permissions.supplierRecords
        ? (db.supplierServices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : [],
      boosterPrices: permissions.priceSettings
        ? (db.boosterPrices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : (db.boosterPrices || []).filter((row) => row.active !== false).map(({ level, isDefault }) => ({ level, price: 0, active: true, isDefault: Boolean(isDefault) })),
      armorTypes: (db.armorTypes || []).map(normalizeArmorType),
      supplierGuilds: permissions.supplierRecords || permissions.priceSettings
        ? (db.supplierGuilds || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : [],
      raidNoteTitles: permissions.priceSettings || permissions.raidNotes
        ? (db.raidNoteTitles || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : [],
      buyerPurchaseTypes: permissions.priceSettings || permissions.raidNotes
        ? (db.buyerPurchaseTypes || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }))
        : []
    };
  }
}

export async function getSupplierRate(serviceType) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT price FROM supplier_services WHERE type = $1", [serviceType]);
      return res.rows[0] ? Number(res.rows[0].price) : 0;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const service = db.supplierServices.find((item) => item.type === serviceType);
    return Number(service?.price || 0);
  }
}

export async function getBoosterRate(level) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT price FROM booster_prices WHERE level = $1", [level]);
      return res.rows[0] ? Number(res.rows[0].price) : 0;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const price = db.boosterPrices.find((item) => item.level === level);
    return Number(price?.price || 0);
  }
}

export async function getSupplierServicesList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT type, price, active, is_default FROM supplier_services ORDER BY id ASC");
      return res.rows.map((row) => ({ type: row.type, price: Number(row.price), active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.supplierServices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }));
  }
}

export async function getBoosterPricesList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT level, price, active, is_default FROM booster_prices ORDER BY id ASC");
      return res.rows.map((row) => ({ level: row.level, price: Number(row.price), active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.boosterPrices || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }));
  }
}

export async function getArmorTypesList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT name, active, is_default FROM armor_types ORDER BY id ASC");
      return res.rows.map((row) => ({ name: row.name, active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.armorTypes || []).map(normalizeArmorType);
  }
}

export async function updateArmorTypes(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM armor_types");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO armor_types (name, active, is_default) VALUES ($1, $2, $3)",
          [row.name, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.armorTypes = cleanedRows;
    writeFileDb(db);
    return db.armorTypes;
  }
}

export async function getSupplierGuildsList() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT name, active, is_default FROM supplier_guilds ORDER BY id ASC");
      return res.rows.map((row) => ({ name: row.name, active: Boolean(row.active), isDefault: Boolean(row.is_default) }));
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    return (db.supplierGuilds || []).map((row) => ({ ...row, isDefault: Boolean(row.isDefault) }));
  }
}

export async function updateSupplierGuilds(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM supplier_guilds");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO supplier_guilds (name, active, is_default) VALUES ($1, $2, $3)",
          [row.name, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.supplierGuilds = cleanedRows;
    writeFileDb(db);
    return db.supplierGuilds;
  }
}

export async function updateRaidNoteTitles(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM raid_note_titles");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO raid_note_titles (name, active, is_default) VALUES ($1, $2, $3)",
          [row.name, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.raidNoteTitles = cleanedRows;
    writeFileDb(db);
    return db.raidNoteTitles;
  }
}

export async function updateBuyerPurchaseTypes(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM buyer_purchase_types");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO buyer_purchase_types (name, active, is_default) VALUES ($1, $2, $3)",
          [row.name, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.buyerPurchaseTypes = cleanedRows;
    writeFileDb(db);
    return db.buyerPurchaseTypes;
  }
}

export async function updateSupplierServices(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM supplier_services");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO supplier_services (type, price, active, is_default) VALUES ($1, $2, $3, $4)",
          [row.type, row.price, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.supplierServices = cleanedRows;
    writeFileDb(db);
    return db.supplierServices;
  }
}

export async function updateBoosterPrices(cleanedRows) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM booster_prices");
      for (const row of cleanedRows) {
        await client.query(
          "INSERT INTO booster_prices (level, price, active, is_default) VALUES ($1, $2, $3, $4)",
          [row.level, row.price, row.active, Boolean(row.isDefault)]
        );
      }
      await client.query("COMMIT");
      return cleanedRows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    db.boosterPrices = cleanedRows;
    writeFileDb(db);
    return db.boosterPrices;
  }
}
