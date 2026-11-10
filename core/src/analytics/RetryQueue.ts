/**
 * RetryQueue — persistent queue for failed analytics exports.
 * Mirrors Roku's analytics retry mechanism with IndexedDB/localStorage persistence.
 */

const RETRY_QUEUE_KEY = 'ctv_analytics_retry';

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, val: string): void;
  removeItem(key: string): void;
}

export class RetryQueue {
  private queue: unknown[][] = [];
  private storage: StorageAdapter | null;
  private maxSize: number;

  constructor(storage?: StorageAdapter | null, maxSize = 10) {
    this.storage = storage ?? null;
    this.maxSize = maxSize;
    // Recover from storage
    this.recover();
  }

  /** Persist queue to storage */
  private persist(): void {
    try {
      this.storage?.setItem(RETRY_QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage not available
    }
  }

  /** Recover queue from storage */
  private recover(): void {
    try {
      const stored = this.storage?.getItem(RETRY_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored) as unknown[][];
        // Enforce max size on recovery
        while (this.queue.length > this.maxSize) {
          this.queue.shift();
        }
      }
    } catch {
      this.queue = [];
    }
  }

  /** Add events to the retry queue */
  add(events: unknown[]): void {
    this.queue.push(events);
    while (this.queue.length > this.maxSize) {
      this.queue.shift();
    }
    this.persist();
  }

  /** Retrieve and remove the first batch of events from the queue */
  pop(): unknown[] | null {
    if (this.queue.length === 0) return null;
    const batch = this.queue.shift();
    this.persist();
    return batch || null;
  }

  /** Get queue size (batches held) */
  size(): number {
    return this.queue.length;
  }

  /** How many events are still owed across the held batches */
  countEvents(): number {
    return this.queue.reduce((total, batch) => total + batch.length, 0);
  }

  /** Clear the queue after successful export */
  clear(): void {
    this.queue = [];
    try {
      this.storage?.removeItem(RETRY_QUEUE_KEY);
    } catch {
      // Storage not available
    }
  }

  /** Check if queue is empty */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
