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
