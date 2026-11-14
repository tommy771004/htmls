/**
 * 驗證後端 server/lineage-web/core.mjs issueWsTicket() 簽出的即時連線票證。
 * 格式：base64url(JSON claims) + "." + base64url(HMAC-SHA256(encoded, secret))
 * claims：{ accountId, username, issuedAt, expiresAt, nonce, realm? }
 * Worker 的 REALM_TICKET_SECRET 必須與後端 REALM_WS_SECRET 相同。
 */
export interface RealtimeTicketPayload {
  sub: string;
  realm: string;
  username: string;
  expiresAt: number;
}

export type TicketVerification =
  | { valid: true; payload: RealtimeTicketPayload }
  | { valid: false; reason: string };

const DEFAULT_REALM = "talking-island-1";

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyRealtimeTicket(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): Promise<TicketVerification> {
  if (!secret) return { valid: false, reason: "ticket_secret_not_configured" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false, reason: "malformed_ticket" };
  const [encoded, sig] = parts;

  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlToBytes(sig);
  } catch {
    return { valid: false, reason: "malformed_ticket" };
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // crypto.subtle.verify 為常數時間比較
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(encoded));
  if (!ok) return { valid: false, reason: "invalid_ticket_signature" };

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
  } catch {
    return { valid: false, reason: "malformed_ticket" };
  }
  if (typeof claims.expiresAt !== "number" || claims.expiresAt <= nowMs) {
    return { valid: false, reason: "ticket_expired" };
  }
  if (claims.accountId == null || claims.accountId === "") {
    return { valid: false, reason: "ticket_missing_subject" };
  }

  return {
    valid: true,
    payload: {
      sub: String(claims.accountId),
      realm: typeof claims.realm === "string" && claims.realm ? claims.realm : DEFAULT_REALM,
      username: String(claims.username ?? ""),
      expiresAt: claims.expiresAt,
    },
  };
}
