// Rate limiter utility to handle API quota limits
export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelay = 100; // Minimum delay between requests (ms)
  private requestsPerMinute = 12; // Stay under 15 to be safe
  private requestTimes: number[] = [];

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Clean old request times (older than 1 minute)
      const oneMinuteAgo = Date.now() - 60000;
      this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);

      // If we're at the limit, wait
      if (this.requestTimes.length >= this.requestsPerMinute) {
        const oldestRequest = this.requestTimes[0];
        const waitTime = 60000 - (Date.now() - oldestRequest) + 100; // Add 100ms buffer
        if (waitTime > 0) {
          console.log(`Rate limit: Waiting ${Math.ceil(waitTime / 1000)}s before next request...`);
          await this.delay(waitTime);
          // Clean again after waiting
          this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
        }
      }

      // Execute the next request
      const request = this.queue.shift();
      if (request) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        // Ensure minimum delay between requests
        if (timeSinceLastRequest < this.minDelay) {
          await this.delay(this.minDelay - timeSinceLastRequest);
        }

        this.lastRequestTime = Date.now();
        this.requestTimes.push(this.lastRequestTime);
        
        try {
          await request();
        } catch (error) {
          // If it's a rate limit error, wait and retry
          if (this.isRateLimitError(error)) {
            const retryDelay = this.extractRetryDelay(error) || 12000; // Default 12s
            console.log(`Rate limit hit. Waiting ${retryDelay / 1000}s before retry...`);
            await this.delay(retryDelay);
            // Retry the request
            this.queue.unshift(request);
          }
        }
      }
    }

    this.processing = false;
  }

  private isRateLimitError(error: any): boolean {
    return error?.code === 429 || 
           error?.status === 'RESOURCE_EXHAUSTED' ||
           error?.message?.includes('quota') ||
           error?.message?.includes('429') ||
           error?.error?.code === 429;
  }

  private extractRetryDelay(error: any): number | null {
    try {
      const retryInfo = error?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
      if (retryInfo?.retryDelay) {
        // Convert seconds to milliseconds
        return parseFloat(retryInfo.retryDelay) * 1000;
      }
      // Try to extract from message
      const match = error?.message?.match(/retry in ([\d.]+)s/i);
      if (match) {
        return parseFloat(match[1]) * 1000;
      }
    } catch (e) {
      console.error('Error extracting retry delay:', e);
    }
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const rateLimiter = new RateLimiter();

