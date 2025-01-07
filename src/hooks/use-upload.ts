import { useState, useCallback, useRef, useEffect } from 'react';
import { FileItem, ChunkMetadata, UploadProgressEvent, WebSocketConfig } from '@/types';
import { generateFileId, createChunks, generatePreview } from '@/lib/utils';
import { WebSocketManager } from '@/lib/websocket-manager';

interface UseUploadOptions {
  endpoint: string;
  websocket?: WebSocketConfig;
  chunkSize?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onUploadStart?: (files: File[]) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (files: File[]) => void;
  onError?: (error: Error) => void;
}

export function useUpload({
  endpoint,
  websocket,
  chunkSize = 1024 * 1024, // 1MB
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedFileTypes,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onError,
}: UseUploadOptions) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);

  // Initialize WebSocket if enabled
  useEffect(() => {
    if (websocket?.enabled && websocket.url) {
      wsManagerRef.current = new WebSocketManager({
        url: websocket.url,
        reconnectAttempts: websocket.reconnectAttempts,
        reconnectInterval: websocket.reconnectInterval,
        onMessage: handleWebSocketMessage,
        onError: (error) => onError?.(error),
      });
      wsManagerRef.current.connect();

      return () => {
        wsManagerRef.current?.disconnect();
      };
    }
  }, [websocket, onError]);

  const handleWebSocketMessage = useCallback((event: UploadProgressEvent) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === event.fileId
          ? {
              ...f,
              progress: event.progress,
              status: event.status,
              error: event.error,
            }
          : f
      )
    );

    if (event.type === 'progress') {
      onUploadProgress?.(event.progress);
    } else if (event.type === 'complete') {
      onUploadComplete?.(files.filter(f => f.id === event.fileId).map(f => f.file));
    } else if (event.type === 'error') {
      onError?.(new Error(event.error));
    }
  }, [files, onUploadProgress, onUploadComplete, onError]);

  const uploadChunk = async (
    chunk: Blob,
    metadata: ChunkMetadata,
    signal: AbortSignal
  ): Promise<Response> => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('metadata', JSON.stringify(metadata));

    return fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal,
    });
  };

  const uploadFile = async (fileItem: FileItem): Promise<void> => {
    const chunks = createChunks(fileItem.file, chunkSize);
    const totalChunks = chunks.length;

    const metadata: ChunkMetadata = {
      fileId: fileItem.id,
      fileName: fileItem.file.name,
      fileSize: fileItem.file.size,
      mimeType: fileItem.file.type,
      totalChunks,
      chunkIndex: 0,
    };

    // Notify WebSocket about upload start if enabled
    if (wsManagerRef.current?.isConnected()) {
      wsManagerRef.current.sendMessage({
        type: 'start',
        fileId: fileItem.id,
        fileName: fileItem.file.name,
        totalChunks,
      });
    }

    for (let i = 0; i < totalChunks; i++) {
      if (!abortControllerRef.current) break;

      metadata.chunkIndex = i;
      
      try {
        const response = await uploadChunk(
          chunks[i],
          metadata,
          abortControllerRef.current.signal
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const progress = ((i + 1) / totalChunks) * 100;

        // If WebSocket is not enabled, update progress locally
        if (!wsManagerRef.current?.isConnected()) {
          setFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id
                ? { ...f, progress, status: 'uploading' }
                : f
            )
          );
          onUploadProgress?.(progress);
        }

        // Notify WebSocket about chunk completion if enabled
        if (wsManagerRef.current?.isConnected()) {
          wsManagerRef.current.sendMessage({
            type: 'chunk_complete',
            fileId: fileItem.id,
            chunkIndex: i,
            totalChunks,
          });
        }
      } catch (error) {
        if (error instanceof Error) {
          const errorEvent: UploadProgressEvent = {
            type: 'error',
            fileId: fileItem.id,
            progress: (i / totalChunks) * 100,
            status: 'error',
            error: error.message,
          };

          if (wsManagerRef.current?.isConnected()) {
            wsManagerRef.current.sendMessage(errorEvent);
          } else {
            handleWebSocketMessage(errorEvent);
          }
        }
        throw error;
      }
    }

    // Notify WebSocket about upload completion if enabled
    if (wsManagerRef.current?.isConnected()) {
      wsManagerRef.current.sendMessage({
        type: 'complete',
        fileId: fileItem.id,
        fileName: fileItem.file.name,
      });
    }
  };

  const addFiles = useCallback(async (newFiles: File[]) => {
    const fileItems: FileItem[] = [];

    for (const file of newFiles) {
      const preview = await generatePreview(file);
      fileItems.push({
        id: generateFileId(),
        file,
        preview,
        progress: 0,
        status: 'pending',
      });
    }

    setFiles(prev => [...prev, ...fileItems]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const startUpload = useCallback(async () => {
    if (isUploading || files.length === 0) return;

    setIsUploading(true);
    abortControllerRef.current = new AbortController();

    const pendingFiles = files.filter(f => f.status === 'pending');
    onUploadStart?.(pendingFiles.map(f => f.file));

    try {
      await Promise.all(pendingFiles.map(uploadFile));
      
      // If WebSocket is not enabled, update completion status locally
      if (!wsManagerRef.current?.isConnected()) {
        setFiles(prev =>
          prev.map(f =>
            f.status === 'uploading'
              ? { ...f, status: 'completed', progress: 100 }
              : f
          )
        );
        onUploadComplete?.(pendingFiles.map(f => f.file));
      }
    } catch (error) {
      if (error instanceof Error) {
        onError?.(error);
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [files, isUploading, onUploadStart, onUploadComplete, onError]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);

    // Notify WebSocket about cancellation if enabled
    if (wsManagerRef.current?.isConnected()) {
      files.forEach(file => {
        if (file.status === 'uploading') {
          wsManagerRef.current?.sendMessage({
            type: 'cancel',
            fileId: file.id,
          });
        }
      });
    }
  }, [files]);

  return {
    files,
    isUploading,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
  };
}
