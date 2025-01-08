import { StreamConfig, StreamingState, StreamChunk, MemoryConfig, SecurityConfig, MemoryStats } from '@/types';
import { WorkerManager } from './worker-manager';
import { ErrorManager } from './error-manager';
import { MemoryManager } from './memory-manager';
import { SecurityManager } from './security-manager';

export class StreamUploadManager {
  private workerManager: WorkerManager;
  private errorManager: ErrorManager;
  private memoryManager: MemoryManager;
  private securityManager: SecurityManager;
  private config: Required<StreamConfig>;
  private activeStreams: Map<string, StreamingState>;
  private abortControllers: Map<string, AbortController>;
  private encryptionKeys: Map<string, CryptoKey>;

  constructor(
    config: StreamConfig = {},
    memoryConfig: MemoryConfig = {},
    securityConfig: SecurityConfig = {}
  ) {
    this.config = {
      chunkSize: config.chunkSize || 1024 * 1024,
      concurrentStreams: config.concurrentStreams || 3,
      compressionEnabled: config.compressionEnabled ?? true,
      validateChunks: config.validateChunks ?? true,
      retryAttempts: config.retryAttempts || 3,
      workerConfig: config.workerConfig || {}
    };

    this.workerManager = new WorkerManager(this.config.workerConfig);
    this.errorManager = new ErrorManager();
    this.memoryManager = new MemoryManager(memoryConfig);
    this.securityManager = new SecurityManager(securityConfig);
    this.activeStreams = new Map();
    this.abortControllers = new Map();
    this.encryptionKeys = new Map();

    // Setup memory cleanup callback
    this.memoryManager.onBeforeGC(() => {
      this.cleanupInactiveStreams();
    });
  }

  private async cleanupInactiveStreams(): Promise<void> {
    for (const [fileId, state] of this.activeStreams.entries()) {
      if (state.status === 'completed' || state.status === 'error') {
        await this.releaseStreamResources(fileId);
      }
    }
  }

  private async releaseStreamResources(fileId: string): Promise<void> {
    const state = this.activeStreams.get(fileId);
    if (!state) return;

    // Clean up any tracked resources
    const resourceIds = state.resourceIds || [];
    for (const id of resourceIds) {
      await this.memoryManager.releaseResource(id);
    }

    this.activeStreams.delete(fileId);
    this.abortControllers.delete(fileId);
  }

  private async validateAndPrepareUpload(
    file: File,
    userId: string,
    accessToken: string
  ): Promise<void> {
    // Validate access token
    if (!this.securityManager.validateAccessToken(accessToken)) {
      throw new Error('Invalid or expired access token');
    }

    // Check rate limits
    if (!this.securityManager.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded');
    }

    // Validate file
    const validationResult = await this.securityManager.validateFile(file);
    if (!validationResult.isValid) {
      throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
    }
  }

  private async processChunkWithWorker(
    chunk: StreamChunk,
    fileId: string,
    compress: boolean
  ): Promise<Blob> {
    let processedChunk: Blob;

    if (compress) {
      processedChunk = await this.workerManager.addTask('compress', chunk);
    } else {
      processedChunk = chunk.data as Blob;
    }

    // Encrypt the chunk if encryption is enabled
    const key = this.encryptionKeys.get(fileId);
    if (key) {
      const buffer = await processedChunk.arrayBuffer();
      const encryptedBuffer = await this.securityManager.encryptChunk(buffer, key);
      processedChunk = new Blob([encryptedBuffer]);
    }

    return processedChunk;
  }

  private async validateChunkWithWorker(chunk: StreamChunk): Promise<boolean> {
    const result = await this.workerManager.addTask('validate', chunk);
    return result.isValid;
  }

  private async createReadableStream(
    file: File,
    fileId: string,
    signal: AbortSignal
  ): Promise<ReadableStream<StreamChunk>> {
    let offset = 0;
    const chunkSize = this.config.chunkSize;
    const memoryManager = this.memoryManager;
    const activeStreams = this.activeStreams;

    return new ReadableStream({
      async pull(controller) {
        if (offset >= file.size) {
          controller.close();
          return;
        }

        if (signal.aborted) {
          controller.error(new Error('Stream aborted'));
          return;
        }

        const chunk = file.slice(offset, offset + chunkSize);
        offset += chunkSize;

        const streamChunk = {
          data: chunk,
          offset: offset - chunkSize,
          size: chunk.size,
          index: Math.floor((offset - chunkSize) / chunkSize)
        };

        // Track chunk in memory manager
        const resourceId = memoryManager.trackResource(chunk, 'chunk', {
          size: chunk.size,
          offset: streamChunk.offset,
          index: streamChunk.index
        });

        // Store resource ID for cleanup
        const state = activeStreams.get(fileId);
        if (state) {
          state.resourceIds = state.resourceIds || [];
          state.resourceIds.push(resourceId);
        }

        controller.enqueue(streamChunk);
      }
    });
  }

  private async createTransformStream(
    fileId: string,
    compress: boolean,
    validate: boolean
  ): Promise<TransformStream<StreamChunk, Blob>> {
    return new TransformStream({
      transform: async (chunk, controller) => {
        try {
          if (validate) {
            const isValid = await this.validateChunkWithWorker(chunk);
            if (!isValid) {
              throw new Error(`Invalid chunk at offset ${chunk.offset}`);
            }
          }

          const processedChunk = await this.processChunkWithWorker(chunk, fileId, compress);
          controller.enqueue(processedChunk);

          // Update progress
          const state = this.activeStreams.get(fileId);
          if (state) {
            state.bytesProcessed += chunk.size;
            if (state.onProgress) {
              state.onProgress({
                bytesUploaded: state.bytesProcessed,
                totalBytes: state.totalSize,
                speed: this.calculateSpeed(state),
                estimatedTimeRemaining: this.calculateTimeRemaining(state)
              });
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  private createWritableStream(
    endpoint: string,
    fileId: string,
    signal: AbortSignal
  ): WritableStream<Blob> {
    return new WritableStream({
      write: async (chunk) => {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('fileId', fileId);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          signal
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
      }
    });
  }

  private calculateSpeed(state: StreamingState): number {
    const elapsed = Date.now() - state.startTime;
    return elapsed > 0 ? (state.bytesProcessed / elapsed) * 1000 : 0;
  }

  private calculateTimeRemaining(state: StreamingState): number {
    const speed = this.calculateSpeed(state);
    if (speed === 0) return 0;
    
    const remaining = state.totalSize - state.bytesProcessed;
    return remaining / speed;
  }

  async startStreaming(
    file: File,
    endpoint: string,
    options: {
      onProgress?: (progress: any) => void;
      userId: string;
      accessToken: string;
    }
  ): Promise<void> {
    const { onProgress, userId, accessToken } = options;
    const fileId = crypto.randomUUID();

    try {
      // Validate and prepare upload
      await this.validateAndPrepareUpload(file, userId, accessToken);

      // Generate encryption key if needed
      if (this.securityManager.securityConfig.encryption.enabled) {
        const key = await this.securityManager.generateEncryptionKey();
        this.encryptionKeys.set(fileId, key);
      }

      const abortController = new AbortController();
      this.abortControllers.set(fileId, abortController);
      this.activeStreams.set(fileId, {
        fileId,
        totalSize: file.size,
        bytesProcessed: 0,
        startTime: Date.now(),
        status: 'streaming',
        onProgress,
        resourceIds: []
      });

      const readableStream = await this.createReadableStream(
        file,
        fileId,
        abortController.signal
      );

      const transformStream = await this.createTransformStream(
        fileId,
        this.config.compressionEnabled,
        this.config.validateChunks
      );

      const writableStream = this.createWritableStream(
        endpoint,
        fileId,
        abortController.signal
      );

      await readableStream
        .pipeThrough(transformStream)
        .pipeTo(writableStream);

      const state = this.activeStreams.get(fileId);
      if (state) {
        state.status = 'completed';
        if (state.onProgress) {
          state.onProgress({
            bytesUploaded: state.totalSize,
            totalBytes: state.totalSize,
            speed: 0,
            estimatedTimeRemaining: 0
          });
        }
      }
    } catch (error) {
      const state = this.activeStreams.get(fileId);
      if (state) {
        state.status = 'error';
        state.error = error as Error;
      }
      // Release rate limit on error
      this.securityManager.releaseRateLimit(userId);
      throw error;
    } finally {
      // Cleanup
      await this.releaseStreamResources(fileId);
      this.encryptionKeys.delete(fileId);
      this.securityManager.releaseRateLimit(userId);
    }
  }

  async abortStream(fileId: string): Promise<void> {
    const controller = this.abortControllers.get(fileId);
    if (controller) {
      controller.abort();
      await this.releaseStreamResources(fileId);
    }
  }

  getStreamingState(fileId: string): StreamingState | undefined {
    return this.activeStreams.get(fileId);
  }

  getMemoryStats(): MemoryStats {
    return this.memoryManager.getMemoryStats();
  }

  dispose(): void {
    this.workerManager.dispose();
    this.memoryManager.dispose();
    this.securityManager.dispose();
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.activeStreams.clear();
    this.encryptionKeys.clear();
  }
}
