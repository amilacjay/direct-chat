import type { WsMessage } from './types';

type WsEventMap = {
  presence: Extract<WsMessage, { type: 'presence' }>;
  signal: Extract<WsMessage, { type: 'signal' }>;
  relay: Extract<WsMessage, { type: 'relay' }>;
  notification: Extract<WsMessage, { type: 'notification' }>;
  pong: Extract<WsMessage, { type: 'pong' }>;
  error: Extract<WsMessage, { type: 'error' }>;
  open: undefined;
  close: undefined;
};

type Listener<K extends keyof WsEventMap> = (data: WsEventMap[K]) => void;

const BASE_URL = import.meta.env.VITE_API_URL as string;

function getWsBase(): string {
  // When VITE_API_URL is set (dev), derive the ws origin from it.
  // When empty (prod, same-origin behind nginx), build from the page origin.
  if (BASE_URL) {
    return BASE_URL.replace(/^http/, 'ws');
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}`;
}

export class WSClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = false;
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  connect(token: string): void {
    this.token = token;
    this.shouldReconnect = true;
    this.reconnectDelay = 1000;
    this._doConnect();
  }

  private _doConnect(): void {
    if (!this.token) return;
    const url = `${getWsBase()}/ws?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectDelay = 1000;
      this._startHeartbeat();
      this._emit('open', undefined);
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        this._emit(msg.type as keyof WsEventMap, msg as never);
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this._stopHeartbeat();
      this._emit('close', undefined);
      if (this.shouldReconnect) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private _scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this._doConnect();
    }, this.reconnectDelay);
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25000);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this._stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  send(obj: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  on<K extends keyof WsEventMap>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as (...args: unknown[]) => void);
  }

  off<K extends keyof WsEventMap>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
  }

  private _emit<K extends keyof WsEventMap>(event: K, data: WsEventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

// Singleton
export const wsClient = new WSClient();
