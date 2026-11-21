import { getPool, isPostgres, readFileDb, writeFileDb } from "./core.js";

// -------------------------------------------------------------
// Persistent Sessions Layer
// -------------------------------------------------------------

export async function getSessionFromDb(sessionId) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const res = await client.query("SELECT * FROM sessions WHERE id = $1", [sessionId]);
      if (!res.rows.length) return null;
      const row = res.rows[0];
      if (Date.now() > Number(row.expires_at || 0)) {
        await client.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
        return null;
      }
      return {
        role: row.role,
        discordId: row.discord_id,
        username: row.username,
        csrfToken: row.csrf_token,
        createdAt: Number(row.created_at),
        expiresAt: Number(row.expires_at)
      };
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const session = db.sessions?.[sessionId];
    if (!session) return null;
    if (Date.now() > Number(session.expiresAt || 0)) {
      delete db.sessions[sessionId];
      writeFileDb(db);
      return null;
    }
    return session;
  }
}

export async function saveSessionToDb(sessionId, session) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(`
        INSERT INTO sessions (id, role, discord_id, username, csrf_token, created_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          discord_id = EXCLUDED.discord_id,
          username = EXCLUDED.username,
          csrf_token = EXCLUDED.csrf_token,
          expires_at = EXCLUDED.expires_at
      `, [
        sessionId, session.role, session.discordId, session.username,
        session.csrfToken, session.createdAt, session.expiresAt
      ]);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.sessions) db.sessions = {};
    db.sessions[sessionId] = {
      role: session.role,
      discordId: session.discordId,
      username: session.username,
      csrfToken: session.csrfToken,
      createdAt: Number(session.createdAt),
      expiresAt: Number(session.expiresAt)
    };
    writeFileDb(db);
  }
}

// Keeps the users directory current on each Discord login. Best effort by design:
// the caller ignores failures so a directory problem can never block signing in.
export async function recordUserLogin({ discordId, username, role }) {
  if (!discordId) return;
  const now = new Date().toISOString();
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query(
        `INSERT INTO users (discord_id, display_name, role, first_seen_at, last_login_at)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (discord_id) DO UPDATE SET
           display_name = EXCLUDED.display_name, role = EXCLUDED.role, last_login_at = EXCLUDED.last_login_at`,
        [String(discordId), String(username || discordId), role || null, now]
      );
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    const users = Array.isArray(db.users) ? db.users : [];
    const existing = users.find((user) => user.discordId === String(discordId));
    if (existing) {
      Object.assign(existing, { displayName: String(username || discordId), role: role || null, lastLoginAt: now });
    } else {
      users.push({ discordId: String(discordId), displayName: String(username || discordId), role: role || null, firstSeenAt: now, lastLoginAt: now });
    }
    db.users = users;
    writeFileDb(db);
  }
}

export async function deleteSessionFromDb(sessionId) {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      await client.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (db.sessions && db.sessions[sessionId]) {
      delete db.sessions[sessionId];
      writeFileDb(db);
    }
  }
}

export async function pruneExpiredSessions() {
  if (isPostgres()) {
    const client = await getPool().connect();
    try {
      const now = Date.now();
      await client.query("DELETE FROM sessions WHERE expires_at < $1", [now]);
    } catch (err) {
      console.error("Session pruning failed:", err.message);
    } finally {
      client.release();
    }
  } else {
    const db = readFileDb();
    if (!db.sessions) return;
    const now = Date.now();
    let changed = false;
    for (const [id, session] of Object.entries(db.sessions)) {
      if (now > Number(session.expiresAt || 0)) {
        delete db.sessions[id];
        changed = true;
      }
    }
    if (changed) writeFileDb(db);
  }
}
