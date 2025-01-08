import { WorkerConfig, WorkerTask, WorkerMessage, WorkerTaskType } from '@/types';

export class WorkerManager {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeWorkers: Map<Worker, WorkerTask> = new Map();
  private config: Required<WorkerConfig>;

  constructor(config: WorkerConfig = {}) {
    this.config = {
      maxWorkers: config.maxWorkers || navigator.hardwareConcurrency || 4,
      taskTimeout: config.taskTimeout || 30000,
      memoryLimit: config.memoryLimit || 50 * 1024 * 1024, // 50MB per worker
      retryAttempts: config.retryAttempts || 3
    };
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    const workerCode = `
      let memoryUsage = 0;

      async function processChunk(chunk, type) {
        try {
          switch (type) {
            case 'compress':
              const compressedData = await compress(chunk.data);
              return { type: 'success', data: compressedData };
            case 'validate':
              const isValid = await validate(chunk.data);
              return { type: 'success', data: { isValid } };
            case 'hash':
              const hash = await calculateHash(chunk.data);
              return { type: 'success', data: { hash } };
            default:
              throw new Error('Unknown task type');
          }
        } catch (error) {
          return { type: 'error', error: error.message };
        }
      }

      async function compress(data) {
        // Implementation depends on the compression library used
        // For now, we'll use CompressionStream if available
        if (typeof CompressionStream !== 'undefined') {
          const cs = new CompressionStream('gzip');
          const writer = cs.writable.getWriter();
          await writer.write(data);
          await writer.close();
          const reader = cs.readable.getReader();
          const chunks = [];
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          return new Blob(chunks);
        }
        return data; // Fallback if CompressionStream is not available
      }

      async function validate(data) {
        // Basic validation
        if (data instanceof Blob) {
          return data.size > 0;
        }
        return data && data.length > 0;
      }

      async function calculateHash(data) {
        const buffer = await (data instanceof Blob ? data.arrayBuffer() : data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      self.onmessage = async function(e) {
        const { taskId, type, chunk } = e.data;
        
        try {
          const result = await processChunk(chunk, type);
          self.postMessage({ taskId, ...result });
        } catch (error) {
          self.postMessage({ 
            taskId, 
            type: 'error', 
            error: error.message 
          });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < this.config.maxWorkers; i++) {
      const worker = new Worker(workerUrl);
      worker.onmessage = this.handleWorkerMessage.bind(this);
      worker.onerror = this.handleWorkerError.bind(this);
      this.workers.push(worker);
    }

    URL.revokeObjectURL(workerUrl);
  }

  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const { taskId, type, data, error } = event.data;
    const worker = event.target as Worker;
    const task = this.activeWorkers.get(worker);

    if (!task) return;

    if (type === 'error') {
      if (task.attempts < this.config.retryAttempts) {
        // Retry the task
        task.attempts++;
        this.taskQueue.unshift(task);
      } else {
        task.reject(new Error(error || 'Task failed'));
      }
    } else {
      task.resolve(data);
    }

    this.activeWorkers.delete(worker);
    this.processNextTask();
  }

  private handleWorkerError(error: ErrorEvent): void {
    const worker = error.target as Worker;
    const task = this.activeWorkers.get(worker);

    if (task) {
      if (task.attempts < this.config.retryAttempts) {
        task.attempts++;
        this.taskQueue.unshift(task);
      } else {
        task.reject(error);
      }
      this.activeWorkers.delete(worker);
    }

    // Replace the failed worker
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      worker.terminate();
      const newWorker = new Worker(worker.constructor as any);
      newWorker.onmessage = this.handleWorkerMessage.bind(this);
      newWorker.onerror = this.handleWorkerError.bind(this);
      this.workers[index] = newWorker;
    }

    this.processNextTask();
  }

  private async processNextTask(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find(w => !this.activeWorkers.has(w));
    if (!availableWorker) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeWorkers.set(availableWorker, task);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Task timeout'));
      }, this.config.taskTimeout);
    });

    try {
      availableWorker.postMessage({
        taskId: task.id,
        type: task.type,
        chunk: task.chunk
      });

      await Promise.race([
        new Promise((resolve) => {
          task.resolve = resolve;
        }),
        timeoutPromise
      ]);
    } catch (error) {
      task.reject(error);
      this.activeWorkers.delete(availableWorker);
      this.processNextTask();
    }
  }

  async addTask(type: WorkerTaskType, chunk: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: crypto.randomUUID(),
        type,
        chunk,
        attempts: 0,
        resolve,
        reject
      };

      this.taskQueue.push(task);
      this.processNextTask();
    });
  }

  dispose(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers.clear();
  }
}
