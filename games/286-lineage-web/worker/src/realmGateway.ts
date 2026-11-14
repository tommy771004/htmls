export interface WorkerWebSocket {
  accept(): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "close", listener: () => void): void;
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

  constructor(
    private readonly _state: DurableObjectStateLike,
    private readonly pairFactory: WebSocketPairFactory = defaultWebSocketPairFactory,
  ) {}

  get activeConnections(): number {
    return this.connections.size;
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

    server.addEventListener("message", (event) => {
      server.send(processRealmFrame(event.data, subject, realm));
    });

    server.addEventListener("close", () => {
      this.connections.delete(server);
    });

    const upgradeInit = {
      status: 101,
      webSocket: client,
    } as ResponseInit;
    return new Response(null, upgradeInit);
  }
}
