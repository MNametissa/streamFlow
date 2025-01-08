export interface FileItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  preview: PreviewData;
  error?: string;
}

export interface WebSocketConfig {
  enabled: boolean;
  url: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export type SupportedFileType = 
  | 'image'
  | 'video'
  | 'pdf'
  | 'text'
  | 'csv'
  | 'excel'
  | 'json'
  | 'other';

export interface ChunkingConfig {
  type: 'size' | 'lines';
  value: number; // size in bytes or number of lines
}

export interface FileTypeConfig {
  mimeTypes: string[];
  maxSize?: number;
  chunking: ChunkingConfig;
  preview?: boolean;
}

export type FileTypeConfigs = {
  [K in SupportedFileType]?: FileTypeConfig;
};

export interface StreamFlowConfig {
  supportedTypes?: FileTypeConfigs;
  defaultChunkSize?: number;
  defaultLinesPerChunk?: number;
  maxConcurrentUploads?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface StreamFlowProps {
  endpoint: string;
  websocket?: WebSocketConfig;
  config?: StreamFlowConfig;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  multiple?: boolean;
  className?: string;
  onUploadStart?: (files: File[]) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (files: File[]) => void;
  onError?: (error: Error) => void;
}

export interface ChunkMetadata {
  chunkIndex: number;
  totalChunks: number;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadProgressEvent {
  type: 'progress' | 'complete' | 'error' | 'queued';
  fileId: string;
  progress: number;
  status: FileItem['status'];
  error?: string;
  queuePosition?: number;
  estimatedTimeRemaining?: number;
  uploadSpeed?: number;
}

export interface UploadStats {
  speed: number; // bytes per second
  averageSpeed: number;
  timeRemaining: number; // milliseconds
  startTime: number;
  totalBytes: number;
  uploadedBytes: number;
  chunksUploaded: number;
  totalChunks: number;
  retryCount: number;
}

export interface QueueItem {
  fileId: string;
  priority: number;
  status: 'queued' | 'uploading' | 'paused' | 'completed' | 'error';
  stats: UploadStats;
  retryAttempts: number;
}

export interface PreviewData {
  type: 'image' | 'video' | 'pdf' | 'text' | 'spreadsheet' | 'none';
  url?: string;
  content?: string;
  thumbnail?: string;
  headers?: string[];
  rows?: string[][];
}

export interface UploadState {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  uploadedChunks: number[];
  startTime: number;
  lastUpdateTime: number;
  bytesUploaded: number;
  status: 'initialized' | 'uploading' | 'paused' | 'interrupted' | 'completed' | 'error';
  resumeToken: string;
  checksum: string;
  error?: string;
}

export interface ChunkState {
  index: number;
  size: number;
  offset: number;
  checksum: string;
  attempts: number;
  lastAttempt?: number;
  error?: string;
}

export interface ResumableUploadConfig {
  enabled: boolean;
  maxRetries?: number;
  retryDelay?: number;
  checksumVerification?: boolean;
  storageAdapter?: 'localStorage' | 'indexedDB';
  autoSaveInterval?: number;
}

export type ErrorType = 'network' | 'server' | 'validation' | 'storage' | 'unknown';
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type RetryStrategyType = 'immediate' | 'linear' | 'exponential' | 'fibonacci';

export interface ErrorContext {
  fileId?: string;
  chunkIndex?: number;
  operation: string;
  retryCount: number;
  isRecoverable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ErrorReport {
  error: Error;
  type: ErrorType;
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: number;
  stackTrace?: string;
  recommendation: string;
}

export interface RetryStrategyConditions {
  skipIfErrorIncludes?: string[];
  requiresUserAction?: boolean;
  checkFn?: (error: Error) => Promise<boolean>;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  strategy: RetryStrategyType;
  conditions?: RetryStrategyConditions;
}

export interface ErrorHandlingConfig {
  enabled: boolean;
  retryStrategies?: Partial<Record<ErrorType, RetryStrategy>>;
  onError?: (error: ErrorReport) => void;
  maxErrorHistory?: number;
}

export interface WorkerConfig {
  maxWorkers?: number;
  taskTimeout?: number;
  memoryLimit?: number;
  retryAttempts?: number;
}

export type WorkerTaskType = 'compress' | 'validate' | 'hash';

export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  chunk: any;
  attempts: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export interface WorkerMessage {
  taskId: string;
  type: 'success' | 'error';
  data?: any;
  error?: string;
}

export interface StreamConfig {
  chunkSize?: number;
  concurrentStreams?: number;
  compressionEnabled?: boolean;
  validateChunks?: boolean;
  retryAttempts?: number;
  workerConfig?: WorkerConfig;
}

export interface StreamChunk {
  data: Blob;
  offset: number;
  size: number;
  index: number;
}

export interface StreamingState {
  fileId: string;
  totalSize: number;
  bytesProcessed: number;
  startTime: number;
  status: 'streaming' | 'completed' | 'error' | 'aborted';
  error?: Error;
  onProgress?: (progress: any) => void;
  resourceIds: string[];
}

export interface MemoryConfig {
  maxMemoryUsage?: number;
  cleanupInterval?: number;
  enableAutoCleanup?: boolean;
  thresholds?: {
    warning: number;
    critical: number;
  };
}

export type ResourceType = 'chunk' | 'buffer' | 'stream' | 'worker' | 'cache';

export interface ResourceStats {
  type: ResourceType;
  size: number;
  createdAt: number;
  metadata: Record<string, any>;
}

export interface MemoryStats {
  totalAllocated: number;
  activeResources: number;
  peakMemoryUsage: number;
  lastGC: number;
  resourceStats: Map<string, ResourceStats>;
}

export interface MemoryThresholds {
  warning: number;
  critical: number;
}

export interface SecurityConfig {
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

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RateLimitInfo {
  requests: number[];
  concurrentUploads: number;
}

export interface FileSignature {
  offset: number;
  bytes: number[];
}
