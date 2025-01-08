# API Reference

## Classes

### StreamUploadManager

The main class for handling file uploads.

```typescript
class StreamUploadManager {
  constructor(
    config?: StreamConfig,
    memoryConfig?: MemoryConfig,
    securityConfig?: SecurityConfig
  );

  // Core Methods
  async startStreaming(
    file: File,
    endpoint: string,
    options: {
      onProgress?: (progress: ProgressInfo) => void;
      userId: string;
      accessToken: string;
    }
  ): Promise<void>;

  async abortStream(fileId: string): Promise<void>;
  getStreamingState(fileId: string): StreamingState;
  getMemoryStats(): MemoryStats;
  dispose(): void;
}
```

### SecurityManager

Handles security features and file validation.

```typescript
class SecurityManager {
  constructor(config?: SecurityConfig);

  // File Validation
  async validateFile(file: File): Promise<FileValidationResult>;
  
  // Access Control
  generateAccessToken(userId: string): string;
  validateAccessToken(token: string): boolean;
  revokeAccessToken(token: string): void;
  
  // Rate Limiting
  checkRateLimit(userId: string): boolean;
  releaseRateLimit(userId: string): void;
  
  // Encryption
  async generateEncryptionKey(): Promise<CryptoKey>;
  async encryptChunk(chunk: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer>;
  async decryptChunk(encryptedChunk: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer>;
}
```

### MemoryManager

Manages memory usage and resource tracking.

```typescript
class MemoryManager {
  constructor(config?: MemoryConfig);

  // Resource Management
  trackResource(resource: any, type: ResourceType, metadata?: any): string;
  releaseResource(resourceId: string): Promise<void>;
  
  // Memory Monitoring
  getMemoryStats(): MemoryStats;
  checkMemoryUsage(): void;
  
  // Event Handlers
  onBeforeGC(callback: () => void): void;
  dispose(): void;
}
```

### WorkerManager

Manages Web Worker threads for parallel processing.

```typescript
class WorkerManager {
  constructor(config?: WorkerConfig);

  // Task Management
  async addTask(type: string, data: any): Promise<any>;
  terminateWorker(workerId: string): void;
  
  // Worker Pool Management
  getActiveWorkers(): number;
  dispose(): void;
}
```

## Interfaces

### StreamConfig
```typescript
interface StreamConfig {
  chunkSize?: number;
  concurrentStreams?: number;
  compressionEnabled?: boolean;
  validateChunks?: boolean;
  retryAttempts?: number;
  workerConfig?: WorkerConfig;
}
```

### SecurityConfig
```typescript
interface SecurityConfig {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  validateFileSignature?: boolean;
  enableVirusScan?: boolean;
  encryption?: {
    enabled?: boolean;
    algorithm?: string;
    keySize?: number;
  };
  rateLimit?: {
    enabled?: boolean;
    maxRequestsPerMinute?: number;
    maxConcurrentUploads?: number;
  };
  accessControl?: {
    enabled?: boolean;
    tokenExpiration?: number;
    maxTokensPerUser?: number;
  };
}
```

### MemoryConfig
```typescript
interface MemoryConfig {
  maxMemoryUsage?: number;
  cleanupInterval?: number;
  enableAutoCleanup?: boolean;
  thresholds?: {
    warning: number;
    critical: number;
  };
}
```

### Progress Information
```typescript
interface ProgressInfo {
  percentage: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
  estimatedTimeRemaining: number;
}
```

### Memory Statistics
```typescript
interface MemoryStats {
  totalAllocated: number;
  activeResources: number;
  peakMemoryUsage: number;
  lastGC: number;
  resourceStats: Map<string, ResourceStats>;
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `RATE_LIMIT_EXCEEDED` | User has exceeded their rate limit |
| `INVALID_FILE` | File validation failed |
| `MEMORY_LIMIT_EXCEEDED` | System memory limit exceeded |
| `INVALID_TOKEN` | Invalid or expired access token |
| `ENCRYPTION_FAILED` | Chunk encryption failed |
| `WORKER_ERROR` | Worker thread error |
| `NETWORK_ERROR` | Network-related error |
| `VALIDATION_ERROR` | Chunk validation failed |

## Events

### Progress Event
```typescript
interface ProgressEvent {
  percentage: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
  estimatedTimeRemaining: number;
}
```

### Memory Warning Event
```typescript
interface MemoryWarningEvent {
  usage: number;
  threshold: number;
  type: 'warning' | 'critical';
}
```

## Constants

```typescript
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const DEFAULT_CONCURRENT_STREAMS = 3;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_MEMORY_LIMIT = 100 * 1024 * 1024; // 100MB
const DEFAULT_CLEANUP_INTERVAL = 30000; // 30 seconds
```
