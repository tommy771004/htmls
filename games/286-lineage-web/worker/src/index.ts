import { computeSha256Hex } from "./lib/assetManifest";
import { verifyRealtimeTicket } from "./lib/ticket";
import { RealmGatewayDO } from "./realmGateway";

export { RealmGatewayDO };

export interface R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpEtag?: string;
  customMetadata?: Record<string, string>;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
}

export interface DurableObjectIdLike {
  toString(): string;
}

export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface EdgeEnv {
  R2_ASSETS?: R2BucketLike;
  REALM_GATEWAY: DurableObjectNamespaceLike;
  REALM_TICKET_SECRET: string;
  ASSET_CACHE_TTL?: string;
}

function extractTicketFromRequest(request: Request, url: URL): string | null {
  const queryTicket = url.searchParams.get("ticket");
  if (queryTicket) {
    return queryTicket;
  }
  const protocolHeader = request.headers.get("Sec-WebSocket-Protocol");
  if (!protocolHeader) {
    return null;
  }
  for (const part of protocolHeader.split(",")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("ticket.")) {
      return trimmed.slice("ticket.".length);
    }
  }
  return null;
}

async function handleAssetRequest(
  key: string,
  url: URL,
  env: EdgeEnv,
): Promise<Response> {
  if (!key || key.includes("..")) {
    return Response.json({ error: "invalid_asset_key" }, { status: 400 });
  }

  if (!env.R2_ASSETS) {
    return Response.json({ error: "r2_not_configured" }, { status: 503 });
  }

  const object = await env.R2_ASSETS.get(key);
  if (!object) {
    return Response.json({ error: "asset_not_found" }, { status: 404 });
  }

  const bytes = await object.arrayBuffer();
  const actualSha256 = await computeSha256Hex(bytes);
  const expectedSha256 =
    url.searchParams.get("sha256")?.toLowerCase() ??
    object.customMetadata?.sha256?.toLowerCase() ??
    null;

  if (expectedSha256 && expectedSha256 !== actualSha256) {
    return Response.json(
      { error: "asset_integrity_mismatch", expectedSha256, actualSha256 },
      { status: 502 },
    );
  }

  const maxAge = env.ASSET_CACHE_TTL ?? "31536000";
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Cache-Control": `public, max-age=${maxAge}, immutable`,
    "X-Asset-Sha256": actualSha256,
    "Access-Control-Allow-Origin": "*",
  });
  if (object.httpEtag) {
    headers.set("ETag", object.httpEtag);
  }

  return new Response(bytes, { status: 200, headers });
}

async function handleWebSocketRoute(
  request: Request,
  url: URL,
  env: EdgeEnv,
): Promise<Response> {
  const token = extractTicketFromRequest(request, url);
  if (!token) {
    return Response.json({ error: "missing_ticket" }, { status: 401 });
  }

  const verification = await verifyRealtimeTicket(token, env.REALM_TICKET_SECRET);
  if (!verification.valid) {
    return Response.json({ error: verification.reason }, { status: 401 });
  }

  const id = env.REALM_GATEWAY.idFromName(verification.payload.realm);
  const stub = env.REALM_GATEWAY.get(id);
  const forwardedUrl = new URL(request.url);
  forwardedUrl.searchParams.set("sub", verification.payload.sub);
  forwardedUrl.searchParams.set("realm", verification.payload.realm);

  return stub.fetch(new Request(forwardedUrl.toString(), request));
}

const worker = {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, edge: "cloudflare-workers" });
    }

    if (url.pathname.startsWith("/assets/")) {
      const key = decodeURIComponent(url.pathname.slice("/assets/".length));
      return handleAssetRequest(key, url, env);
    }

    if (url.pathname === "/ws") {
      return handleWebSocketRoute(request, url, env);
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
};

export default worker;
