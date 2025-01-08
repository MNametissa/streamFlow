import { FileItem, UploadState, ChunkState, ResumableUploadConfig, ErrorHandlingConfig } from '@/types';
import { StateManager } from './state-manager';
import { createChunks, Chunk } from './chunking';
import { ChunkProcessor } from './chunk-processor';
import { ErrorManager } from './error-manager';

interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
  estimatedTimeRemaining: number;
}

export class ResumableUploadManager {
  private stateManager: StateManager;
  private errorManager: ErrorManager;
  private config: Required<ResumableUploadConfig>;
  private errorConfig: Required<ErrorHandlingConfig>;
  private abortControllers: Map<string, AbortController>;
  private uploadPromises: Map<string, Promise<void>>;

  constructor(
    config: ResumableUploadConfig,
    errorConfig: ErrorHandlingConfig = { enabled: true }
  ) {
    this.config = {
      enabled: config.enabled,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      checksumVerification: config.checksumVerification ?? true,
      storageAdapter: config.storageAdapter || 'indexedDB',
      autoSaveInterval: config.autoSaveInterval || 5000
    };

    this.errorConfig = {
      enabled: errorConfig.enabled,
      retryStrategies: errorConfig.retryStrategies || {},
      onError: errorConfig.onError || (() => {}),
      maxErrorHistory: errorConfig.maxErrorHistory || 50
    };

    this.stateManager = new StateManager(
      this.config.storageAdapter === 'localStorage' ? 
        new (window as any).IndexedDBAdapter : 
        new (window as any).LocalStorageAdapter,
      this.config.autoSaveInterval
    );

    this.errorManager = new ErrorManager();
    if (this.errorConfig.retryStrategies) {
      Object.entries(this.errorConfig.retryStrategies).forEach(([type, strategy]) => {
        this.errorManager.addRetryStrategy(type as any, strategy);
      });
    }
    if (this.errorConfig.onError) {
      this.errorManager.onError(this.errorConfig.onError);
    }

    this.abortControllers = new Map();
    this.uploadPromises = new Map();
  }

  private async verifyChecksum(chunk: Chunk): Promise<string> {
    const buffer = chunk.type === 'binary'
      ? await (chunk.data as Blob).arrayBuffer()
      : new TextEncoder().encode(JSON.stringify(chunk.data));

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async uploadChunk(
    endpoint: string,
    chunk: Chunk,
    fileId: string,
    resumeToken: string,
    signal: AbortSignal
  ): Promise<Response> {
    const formData = new FormData();
    formData.append('chunk', chunk.type === 'binary' 
      ? chunk.data as Blob 
      : new Blob([JSON.stringify(chunk.data)]));
    formData.append('index', chunk.index.toString());
    formData.append('total', chunk.total.toString());
    formData.append('fileId', fileId);
    formData.append('resumeToken', resumeToken);

    if (this.config.checksumVerification) {
      const checksum = await this.verifyChecksum(chunk);
      formData.append('checksum', checksum);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunk.index}: ${response.statusText}`);
    }

    return response;
  }

  private async uploadChunkWithRetry(
    endpoint: string,
    chunk: Chunk,
    fileId: string,
    resumeToken: string,
    signal: AbortSignal
  ): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (true) {
      try {
        const chunkState: ChunkState = {
          index: chunk.index,
          size: chunk.type === 'binary' 
            ? (chunk.data as Blob).size 
            : new Blob([JSON.stringify(chunk.data)]).size,
          offset: 0,
          checksum: await this.verifyChecksum(chunk),
          attempts: attempts + 1,
          lastAttempt: Date.now()
        };

        await this.stateManager.saveChunkState(fileId, chunk, chunkState);
        await this.uploadChunk(endpoint, chunk, fileId, resumeToken, signal);
        await this.stateManager.updateProgress(fileId, chunk.index, chunkState.size);
        return;
      } catch (error) {
        lastError = error as Error;
        if (signal.aborted) throw error;

        const errorContext = {
          fileId,
          chunkIndex: chunk.index,
          operation: 'uploadChunk',
          retryCount: attempts,
          isRecoverable: true,
          metadata: {
            endpoint,
            chunkSize: chunk.type === 'binary' 
              ? (chunk.data as Blob).size 
              : new Blob([JSON.stringify(chunk.data)]).size
          }
        };

        const { shouldRetry, retryDelay } = await this.errorManager.handleError(
          lastError,
          errorContext
        );

        if (!shouldRetry) {
          throw lastError;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async startUpload(
    fileItem: FileItem,
    endpoint: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    // Check if there's an existing upload
    if (this.uploadPromises.has(fileItem.id)) {
      throw new Error('Upload already in progress');
    }

    const abortController = new AbortController();
    this.abortControllers.set(fileItem.id, abortController);

    const uploadPromise = this.performUpload(fileItem, endpoint, onProgress, abortController.signal);
    this.uploadPromises.set(fileItem.id, uploadPromise);

    try {
      await uploadPromise;
    } finally {
      this.uploadPromises.delete(fileItem.id);
      this.abortControllers.delete(fileItem.id);
    }
  }

  private async performUpload(
    fileItem: FileItem,
    endpoint: string,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      let state = await this.stateManager.getState(fileItem.id);
      const isResume = !!state;

      if (!state) {
        state = await this.stateManager.initializeState(fileItem);
      }

      const chunks = await createChunks(fileItem.file, {
        mimeTypes: [fileItem.file.type],
        chunking: {
          type: 'size',
          value: 1024 * 1024 // 1MB chunks
        }
      });

      state.totalChunks = chunks.length;
      await this.stateManager.saveState(fileItem.id, state);

      const remainingChunks = isResume
        ? await this.stateManager.getResumableChunks(fileItem.id)
        : Array.from({ length: chunks.length }, (_, i) => i);

      const startTime = Date.now();
      let lastProgressUpdate = startTime;
      let bytesUploaded = state.bytesUploaded;

      await Promise.all(
        remainingChunks.map(async (index) => {
          const chunk = chunks[index];
          try {
            await this.uploadChunkWithRetry(
              endpoint,
              chunk,
              fileItem.id,
              state!.resumeToken,
              signal!
            );

            bytesUploaded += chunk.type === 'binary'
              ? (chunk.data as Blob).size
              : new Blob([JSON.stringify(chunk.data)]).size;

            const now = Date.now();
            if (now - lastProgressUpdate > 100 && onProgress) {
              const timeElapsed = (now - startTime) / 1000;
              const speed = bytesUploaded / timeElapsed;
              const remaining = fileItem.file.size - bytesUploaded;
              const estimatedTimeRemaining = remaining / speed;

              onProgress({
                bytesUploaded,
                totalBytes: fileItem.file.size,
                speed,
                estimatedTimeRemaining
              });

              lastProgressUpdate = now;
            }
          } catch (error) {
            const errorContext = {
              fileId: fileItem.id,
              chunkIndex: index,
              operation: 'uploadChunk',
              retryCount: 0,
              isRecoverable: true
            };

            await this.errorManager.handleError(error as Error, errorContext);
            throw error;
          }
        })
      );

      state.status = 'completed';
      state.bytesUploaded = fileItem.file.size;
      await this.stateManager.saveState(fileItem.id, state);

      if (onProgress) {
        onProgress({
          bytesUploaded: fileItem.file.size,
          totalBytes: fileItem.file.size,
          speed: 0,
          estimatedTimeRemaining: 0
        });
      }
    } catch (error) {
      const errorContext = {
        fileId: fileItem.id,
        operation: 'performUpload',
        retryCount: 0,
        isRecoverable: false
      };

      await this.errorManager.handleError(error as Error, errorContext);
      throw error;
    }
  }

  async pauseUpload(fileId: string): Promise<void> {
    const controller = this.abortControllers.get(fileId);
    if (controller) {
      controller.abort();
      const state = await this.stateManager.getState(fileId);
      if (state) {
        state.status = 'paused';
        await this.stateManager.saveState(fileId, state);
      }
    }
  }

  async resumeUpload(
    fileItem: FileItem,
    endpoint: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    const canResume = await this.stateManager.canResume(fileItem.id);
    if (!canResume) {
      throw new Error('Upload cannot be resumed');
    }

    return this.startUpload(fileItem, endpoint, onProgress);
  }

  async cancelUpload(fileId: string): Promise<void> {
    await this.pauseUpload(fileId);
    await this.stateManager.removeState(fileId);
  }

  dispose(): void {
    this.stateManager.dispose();
    this.errorManager.clearErrorHistory();
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.uploadPromises.clear();
  }
}
