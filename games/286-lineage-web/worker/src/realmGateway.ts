export interface WorkerWebSocket {
  accept(): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "close", listener: () => void): void;
  addEventListener(type: "error", listener: () => void): void;
}

export interface DurableObjectStateLike {
  id?: unknown;
}

export interface WebSocketPairFactory {
  create(): [WorkerWebSocket, WorkerWebSocket];
}

const defaultWebSocketPairFactory: WebSocketPairFactory = {
  create() {
    const Ctor = (globalThis as unknown as { WebSocketPair: new () => [unknown, unknown] })
      .WebSocketPair;
    const pair = new Ctor();
    return [pair[0] as WorkerWebSocket, pair[1] as WorkerWebSocket];
  },
};

/**
 * Handles a decoded realtime client JSON command and produces a structured JSON response frame.
 */
export function processRealmFrame(
  rawMessage: unknown,
  subject: string,
  realm: string,
): string {
  try {
    const parsed = JSON.parse(String(rawMessage)) as { type?: unknown; seq?: unknown };
    if (parsed.type === "ping") {
      return JSON.stringify({
        type: "pong",
        seq: typeof parsed.seq === "number" ? parsed.seq : 0,
        serverTs: Date.now(),
      });
    }
    if (parsed.type === "hello") {
      return JSON.stringify({
        type: "ready",
        subject,
        realm,
        serverTs: Date.now(),
      });
    }
    if (parsed.type === "action") {
      return JSON.stringify({
        type: "ack",
        acceptedAt: Date.now(),
      });
    }
    return JSON.stringify({ type: "error", code: "unsupported_frame_type" });
  } catch {
    return JSON.stringify({ type: "error", code: "invalid_json" });
  }
}

/**
 * Durable Object coordinating stateful WebSocket connections for a single realm shard.
 */
export class RealmGatewayDO {
  private readonly connections = new Set<WorkerWebSocket>();

  // Cloudflare 以 (state, env) 建立 Durable Object；第三個參數只給測試注入假的 WebSocketPair
  constructor(
    private readonly _state: DurableObjectStateLike,
    _env?: unknown,
    private readonly pairFactory: WebSocketPairFactory = defaultWebSocketPairFactory,
  ) {}

  get activeConnections(): number {
    return this.connections.size;
  }

  /** 有人進出時，把最新在線人數推給同一個 realm 的所有連線（except：剛收到 snapshot 的那條）。 */
  private broadcastPresence(except?: WorkerWebSocket): void {
    const frame = JSON.stringify({ type: "presence", online: this.connections.size });
    for (const ws of [...this.connections]) {
      if (ws === except) continue;
      try {
        ws.send(frame);
      } catch {
        this.connections.delete(ws);
      }
    }
  }

  private drop(ws: WorkerWebSocket): void {
    if (this.connections.delete(ws)) this.broadcastPresence();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const subject = url.searchParams.get("sub") ?? "guest";
    const realm = url.searchParams.get("realm") ?? "aurora-1";

    const [client, server] = this.pairFactory.create();
    server.accept();
    this.connections.add(server);

    server.send(
      JSON.stringify({
        type: "snapshot",
        subject,
        realm,
        online: this.connections.size,
      }),
    );
    this.broadcastPresence(server);

    server.addEventListener("message", (event) => {
      try {
        server.send(processRealmFrame(event.data, subject, realm));
      } catch {
        this.drop(server);
      }
    });

    const leave = () => this.drop(server);
    server.addEventListener("close", leave);
    server.addEventListener("error", leave);

    const upgradeInit = {
      status: 101,
      webSocket: client,
    } as ResponseInit;
    return new Response(null, upgradeInit);
  }
}
