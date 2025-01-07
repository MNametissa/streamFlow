import { UploadProgressEvent } from '@/types';

interface WebSocketOptions {
  url: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onMessage?: (event: UploadProgressEvent) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number;
  private reconnectInterval: number;
  private currentAttempt = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private options: WebSocketOptions;

  constructor(options: WebSocketOptions) {
    this.options = options;
    this.reconnectAttempts = options.reconnectAttempts || 5;
    this.reconnectInterval = options.reconnectInterval || 3000;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.options.url);
      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.currentAttempt = 0;
      this.options.onConnected?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as UploadProgressEvent;
        this.options.onMessage?.(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.options.onDisconnected?.();
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      this.options.onError?.(error instanceof Error ? error : new Error('WebSocket error'));
    };
  }

  private handleReconnect(): void {
    if (this.currentAttempt >= this.reconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.currentAttempt++;
      this.connect();
    }, this.reconnectInterval);
  }

  sendMessage(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
