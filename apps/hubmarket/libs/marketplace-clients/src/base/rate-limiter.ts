/**
 * Token Bucket Rate Limiter
 * Implements rate limiting with burst capability
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private readonly queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private processing = false;

  constructor(
    maxRequests: number,
    windowMs: number,
    burstSize?: number,
  ) {
    this.maxTokens = burstSize || maxRequests;
    this.tokens = this.maxTokens;
    this.refillRate = maxRequests / windowMs;
    this.lastRefill = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refill = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + refill);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      this.refillTokens();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        const item = this.queue.shift();
        item?.resolve();
      } else {
        // Calculate wait time until we have a token
        const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
        await this.sleep(waitTime);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current available tokens (for monitoring)
   */
  getAvailableTokens(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }

  /**
   * Get time until next token is available (ms)
   */
  getWaitTime(): number {
    this.refillTokens();
    if (this.tokens >= 1) {
      return 0;
    }
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }
}
