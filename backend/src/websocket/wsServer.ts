// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PubSubSubscriber {
  subscribe(channel: string, handler: (message: string) => void): void;
  unsubscribe(channel: string): void;
}

export interface WebSocketClient {
  send(data: string): void;
  isAlive: boolean;
  sessionToken?: string;
}

export interface EventReplayStore {
  store(channel: string, message: string, timestamp: Date): Promise<void>;
  getRecent(channel: string, since: Date): Promise<string[]>;
}

// ─── Disconnect message ───────────────────────────────────────────────────────

export const DISCONNECT_MESSAGE = JSON.stringify({ state: 'Disconnected' });

// ─── WebSocketServer ──────────────────────────────────────────────────────────

export class WebSocketServer {
  private clients: Set<WebSocketClient> = new Set();

  constructor(
    private readonly pubSub: PubSubSubscriber,
    private readonly replayStore: EventReplayStore,
    private readonly channels: string[] = ['logs', 'breaks'],
  ) {
    for (const channel of this.channels) {
      this.pubSub.subscribe(channel, (message) => {
        this.handleMessage(channel, message);
      });
    }
  }

  addClient(client: WebSocketClient): void {
    this.clients.add(client);
  }

  removeClient(client: WebSocketClient): void {
    this.clients.delete(client);
    try {
      client.send(DISCONNECT_MESSAGE);
    } catch {
      // client may already be closed
    }
  }

  handleMessage(channel: string, message: string): void {
    const envelope = JSON.stringify({ channel, data: JSON.parse(message) });
    for (const client of this.clients) {
      try {
        client.send(envelope);
      } catch {
        // skip unresponsive clients
      }
    }
    // fire-and-forget store
    this.replayStore.store(channel, message, new Date()).catch(() => {});
  }

  async replayMissedEvents(client: WebSocketClient, since: Date): Promise<void> {
    for (const channel of this.channels) {
      const messages = await this.replayStore.getRecent(channel, since);
      for (const message of messages) {
        const envelope = JSON.stringify({ channel, data: JSON.parse(message) });
        try {
          client.send(envelope);
        } catch {
          // skip if client closed mid-replay
        }
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
