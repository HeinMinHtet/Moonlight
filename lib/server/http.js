

export async function readJson(req, maxBytes = 1_000_000) {
  // Collect raw bytes and decode once: decoding each chunk separately corrupts
  // multi-byte characters (Thai, Myanmar, emoji) that are split across chunks.
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks, size).toString("utf8");
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    throw Object.assign(new Error("Invalid JSON payload."), { statusCode: 400 });
  }
}

export function sendJson(res, status, payload, etag = null) {
  setSecurityHeaders(res);
  res.setHeader("Cache-Control", "no-store");
  if (etag) {
    res.setHeader("ETag", `"${etag}"`);
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

export function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self'; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  );
}

export function notAllowed(res, error = "You do not have access to this action.") {
  sendJson(res, 403, { error });
}
