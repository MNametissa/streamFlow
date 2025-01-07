import { QueueItem, UploadStats } from '@/types';

export class QueueManager {
  private queue: QueueItem[] = [];
  private maxConcurrent: number;
  private activeUploads: number = 0;
  private onQueueUpdate?: (queue: QueueItem[]) => void;

  constructor(maxConcurrent: number = 3, onQueueUpdate?: (queue: QueueItem[]) => void) {
    this.maxConcurrent = maxConcurrent;
    this.onQueueUpdate = onQueueUpdate;
  }

  addToQueue(fileId: string, priority: number = 0): QueueItem {
    const queueItem: QueueItem = {
      fileId,
      priority,
      status: 'queued',
      retryAttempts: 0,
      stats: {
        speed: 0,
        averageSpeed: 0,
        timeRemaining: 0,
        startTime: Date.now(),
        totalBytes: 0,
        uploadedBytes: 0,
        chunksUploaded: 0,
        totalChunks: 0,
        retryCount: 0
      }
    };

    this.queue.push(queueItem);
    this.sortQueue();
    this.notifyQueueUpdate();
    return queueItem;
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Sort by priority first (higher priority first)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by retry attempts (fewer retries first)
      if (a.retryAttempts !== b.retryAttempts) {
        return a.retryAttempts - b.retryAttempts;
      }
      // Finally by start time (earlier start time first)
      return a.stats.startTime - b.stats.startTime;
    });
  }

  getNext(): QueueItem | null {
    if (this.activeUploads >= this.maxConcurrent) {
      return null;
    }

    const nextItem = this.queue.find(item => item.status === 'queued');
    if (nextItem) {
      nextItem.status = 'uploading';
      this.activeUploads++;
      this.notifyQueueUpdate();
    }
    return nextItem || null;
  }

  updateProgress(fileId: string, uploadedBytes: number, totalBytes: number): void {
    const item = this.queue.find(i => i.fileId === fileId);
    if (!item) return;

    const now = Date.now();
    const elapsed = now - item.stats.startTime;
    const speed = uploadedBytes / (elapsed / 1000);
    const remainingBytes = totalBytes - uploadedBytes;
    const timeRemaining = speed > 0 ? (remainingBytes / speed) * 1000 : 0;

    item.stats = {
      ...item.stats,
      speed,
      averageSpeed: (item.stats.averageSpeed + speed) / 2,
      timeRemaining,
      totalBytes,
      uploadedBytes
    };

    this.notifyQueueUpdate();
  }

  completeItem(fileId: string): void {
    const item = this.queue.find(i => i.fileId === fileId);
    if (!item) return;

    item.status = 'completed';
    this.activeUploads--;
    this.notifyQueueUpdate();
  }

  failItem(fileId: string): void {
    const item = this.queue.find(i => i.fileId === fileId);
    if (!item) return;

    item.status = 'error';
    item.retryAttempts++;
    this.activeUploads--;
    this.sortQueue();
    this.notifyQueueUpdate();
  }

  retryItem(fileId: string): void {
    const item = this.queue.find(i => i.fileId === fileId);
    if (!item) return;

    item.status = 'queued';
    item.stats.retryCount++;
    this.sortQueue();
    this.notifyQueueUpdate();
  }

  removeItem(fileId: string): void {
    const index = this.queue.findIndex(i => i.fileId === fileId);
    if (index === -1) return;

    const item = this.queue[index];
    if (item.status === 'uploading') {
      this.activeUploads--;
    }

    this.queue.splice(index, 1);
    this.notifyQueueUpdate();
  }

  getQueuePosition(fileId: string): number {
    return this.queue.findIndex(i => i.fileId === fileId);
  }

  private notifyQueueUpdate(): void {
    this.onQueueUpdate?.(this.queue);
  }

  getStats(): {
    totalFiles: number;
    activeUploads: number;
    queuedFiles: number;
    completedFiles: number;
    failedFiles: number;
    averageSpeed: number;
  } {
    const stats = {
      totalFiles: this.queue.length,
      activeUploads: this.activeUploads,
      queuedFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      averageSpeed: 0
    };

    let totalSpeed = 0;
    let speedCount = 0;

    this.queue.forEach(item => {
      switch (item.status) {
        case 'queued':
          stats.queuedFiles++;
          break;
        case 'completed':
          stats.completedFiles++;
          break;
        case 'error':
          stats.failedFiles++;
          break;
      }

      if (item.stats.speed > 0) {
        totalSpeed += item.stats.speed;
        speedCount++;
      }
    });

    stats.averageSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
    return stats;
  }
}
