import type { StreamBatchConfig, StreamDeltaKind } from '../LitertLm.types';

export interface TokenBatcherOptions extends StreamBatchConfig {
  onFlush: (delta: string, kind: StreamDeltaKind) => void;
}

export class TokenBatcher {
  private buffer = '';
  private kind: StreamDeltaKind = 'token';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushIntervalMs: number;
  private readonly maxTokensPerBatch: number;
  private readonly onFlush: (delta: string, kind: StreamDeltaKind) => void;
  private tokenCount = 0;

  constructor(options: TokenBatcherOptions) {
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
    this.maxTokensPerBatch = options.maxTokensPerBatch ?? 8;
    this.onFlush = options.onFlush;
  }

  append(text: string, kind: StreamDeltaKind = 'token'): void {
    if (this.buffer.length > 0 && kind !== this.kind) {
      this.flush();
    }

    this.kind = kind;
    this.buffer += text;
    this.tokenCount += 1;

    if (this.tokenCount >= this.maxTokensPerBatch) {
      this.flush();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0) {
      this.tokenCount = 0;
      return;
    }

    const delta = this.buffer;
    const kind = this.kind;
    this.buffer = '';
    this.tokenCount = 0;
    this.onFlush(delta, kind);
  }
}
