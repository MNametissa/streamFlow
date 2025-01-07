import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { FileItem, FileTypeConfig, PreviewData } from '@/types';
import { getFileTypeConfig } from './chunking';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function generateFileId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function generatePreview(file: File): Promise<PreviewData> {
  const config = getFileTypeConfig(file);
  
  if (!config.preview) {
    return { type: 'none' };
  }

  try {
    if (file.type.startsWith('image/')) {
      return {
        type: 'image',
        url: URL.createObjectURL(file)
      };
    }

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      await new Promise((resolve) => {
        video.addEventListener('loadedmetadata', resolve);
        video.addEventListener('error', resolve);
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      return {
        type: 'video',
        thumbnail: canvas.toDataURL(),
        url: URL.createObjectURL(file)
      };
    }

    if (file.type === 'application/pdf') {
      return {
        type: 'pdf',
        url: URL.createObjectURL(file)
      };
    }

    if (file.type.startsWith('text/')) {
      const text = await file.text();
      return {
        type: 'text',
        content: text.slice(0, 500) // First 500 characters
      };
    }

    if (
      file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      const { createChunks } = await import('./chunking');
      const chunks = await createChunks(file, config);
      const firstChunk = chunks[0];
      
      if (firstChunk && firstChunk.type === 'lines' && Array.isArray(firstChunk.data)) {
        return {
          type: 'spreadsheet',
          headers: firstChunk.data[0] || [],
          rows: firstChunk.data.slice(1, 6) // First 5 rows
        };
      }
    }

    return { type: 'none' };
  } catch (error) {
    console.error('Error generating preview:', error);
    return { type: 'none' };
  }
}

export function validateFile(file: File, config: FileTypeConfig): { valid: boolean; error?: string } {
  if (config.maxSize && file.size > config.maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatBytes(config.maxSize)}`
    };
  }

  const validType = config.mimeTypes.some(mime => {
    if (mime.endsWith('/*')) {
      return file.type.startsWith(mime.slice(0, -2));
    }
    return file.type === mime;
  });

  if (!validType) {
    return {
      valid: false,
      error: `File type ${file.type} is not supported`
    };
  }

  return { valid: true };
}

export function isValidFileType(file: File, allowedTypes?: string[]): boolean {
  if (!allowedTypes || allowedTypes.length === 0) return true;
  
  return allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const baseType = type.split('/')[0];
      return file.type.startsWith(`${baseType}/`);
    }
    return file.type === type;
  });
}

export function createChunks(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let start = 0;

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push(file.slice(start, end));
    start = end;
  }

  return chunks;
}

