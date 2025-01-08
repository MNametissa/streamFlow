import { ChunkingConfig, FileTypeConfig, SupportedFileType } from '@/types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ChunkProcessor, ChunkProcessingProgress } from './chunk-processor';
import { ChunkCache } from './chunk-cache';
import { DataSanitizer, SanitizationOptions } from './data-sanitizer';

export type ChunkData = Blob | string[][];

export interface Chunk {
  data: ChunkData;
  index: number;
  total: number;
  type: 'binary' | 'lines';
}

const DEFAULT_CONFIGS: Record<SupportedFileType, FileTypeConfig> = {
  image: {
    mimeTypes: ['image/*'],
    maxSize: 50 * 1024 * 1024, // 50MB
    chunking: { type: 'size', value: 1024 * 1024 } // 1MB chunks
  },
  video: {
    mimeTypes: ['video/*'],
    maxSize: 1024 * 1024 * 1024, // 1GB
    chunking: { type: 'size', value: 5 * 1024 * 1024 } // 5MB chunks
  },
  pdf: {
    mimeTypes: ['application/pdf'],
    maxSize: 100 * 1024 * 1024, // 100MB
    chunking: { type: 'size', value: 2 * 1024 * 1024 } // 2MB chunks
  },
  text: {
    mimeTypes: ['text/*'],
    maxSize: 10 * 1024 * 1024, // 10MB
    chunking: { type: 'lines', value: 1000 } // 1000 lines per chunk
  },
  csv: {
    mimeTypes: ['text/csv'],
    maxSize: 50 * 1024 * 1024, // 50MB
    chunking: { type: 'lines', value: 5000 } // 5000 lines per chunk
  },
  excel: {
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    chunking: { type: 'lines', value: 5000 } // 5000 lines per chunk
  },
  json: {
    mimeTypes: ['application/json'],
    maxSize: 50 * 1024 * 1024, // 50MB
    chunking: { type: 'lines', value: 1000 } // 1000 lines per chunk
  },
  other: {
    mimeTypes: ['*/*'],
    maxSize: 50 * 1024 * 1024, // 50MB
    chunking: { type: 'size', value: 1024 * 1024 } // 1MB chunks
  }
};

export interface ChunkingOptions {
  sanitization?: Partial<SanitizationOptions>;
  caching?: {
    enabled: boolean;
    maxSize?: number;
    maxAge?: number;
  };
}

export async function createChunks(
  file: File,
  config: FileTypeConfig,
  onProgress?: (progress: ChunkProcessingProgress) => void,
  options: ChunkingOptions = {}
): Promise<Chunk[]> {
  const processor = new ChunkProcessor(onProgress);
  const sanitizer = new DataSanitizer(options.sanitization);
  const cache = options.caching?.enabled 
    ? new ChunkCache(options.caching.maxSize, options.caching.maxAge)
    : null;

  const cacheKey = `${file.name}-${file.size}-${file.lastModified}`;
  
  if (cache) {
    const cachedChunks = await cache.get(cacheKey);
    if (cachedChunks) {
      return [cachedChunks];
    }
  }

  let chunks: Chunk[];
  if (config.chunking.type === 'size') {
    chunks = await createSizeBasedChunks(file, config.chunking.value, processor, config, sanitizer);
  } else {
    chunks = await createLineBasedChunks(file, config.chunking.value, processor, config, sanitizer);
  }

  if (cache) {
    chunks.forEach(chunk => cache.set(cacheKey, chunk));
  }

  return chunks;
}

async function createSizeBasedChunks(
  file: File,
  chunkSize: number,
  processor: ChunkProcessor,
  config: FileTypeConfig,
  sanitizer: DataSanitizer
): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;
  const totalChunks = Math.ceil(file.size / chunkSize);

  // Sanitize file metadata
  const sanitizedType = sanitizer.sanitizeMimeType(file.type);
  const sanitizedName = sanitizer.sanitizeFileName(file.name);

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    const chunk: Chunk = {
      data: file.slice(start, end, sanitizedType),
      index,
      total: totalChunks,
      type: 'binary'
    };

    const validation = await processor.processChunk(chunk, config);
    if (!validation.valid) {
      throw new Error(`Chunk validation failed: ${validation.error}`);
    }

    if (validation.warnings?.length) {
      console.warn(`Warnings for chunk ${index}:`, validation.warnings);
    }

    chunks.push(chunk);
    start = end;
    index++;
  }

  return chunks;
}

async function createLineBasedChunks(
  file: File,
  linesPerChunk: number,
  processor: ChunkProcessor,
  config: FileTypeConfig,
  sanitizer: DataSanitizer
): Promise<Chunk[]> {
  return new Promise((resolve, reject) => {
    const chunks: Chunk[] = [];
    let currentChunk: string[][] = [];
    let chunkIndex = 0;

    if (file.type === 'text/csv') {
      Papa.parse(file, {
        step: async (results: any) => {
          if (Array.isArray(results.data)) {
            // Sanitize CSV data
            const sanitizedRow = (results.data as string[]).map(cell => 
              sanitizer.sanitizeCSVField(cell)
            );
            
            currentChunk.push(sanitizedRow);
            if (currentChunk.length >= linesPerChunk) {
              const chunk: Chunk = {
                data: currentChunk,
                index: chunkIndex++,
                total: -1,
                type: 'lines'
              };

              try {
                const validation = await processor.processChunk(chunk, config);
                if (!validation.valid) {
                  throw new Error(`Chunk validation failed: ${validation.error}`);
                }

                chunks.push(chunk);
                currentChunk = [];
              } catch (error) {
                reject(error);
                return;
              }
            }
          }
        },
        complete: async () => {
          if (currentChunk.length > 0) {
            const chunk: Chunk = {
              data: currentChunk,
              index: chunkIndex,
              total: chunkIndex + 1,
              type: 'lines'
            };

            try {
              const validation = await processor.processChunk(chunk, config);
              if (!validation.valid) {
                throw new Error(`Final chunk validation failed: ${validation.error}`);
              }
              chunks.push(chunk);
            } catch (error) {
              reject(error);
              return;
            }
          }

          chunks.forEach(c => c.total = chunks.length);
          resolve(chunks);
        },
        error: reject
      });
    } else if (
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

          for (let i = 0; i < jsonData.length; i += linesPerChunk) {
            const rawChunk = jsonData.slice(i, i + linesPerChunk);
            const sanitizedChunk = sanitizer.sanitize(rawChunk) as string[][];
            
            const chunk: Chunk = {
              data: sanitizedChunk,
              index: chunkIndex++,
              total: Math.ceil(jsonData.length / linesPerChunk),
              type: 'lines'
            };

            const validation = await processor.processChunk(chunk, config);
            if (!validation.valid) {
              throw new Error(`Chunk validation failed: ${validation.error}`);
            }

            chunks.push(chunk);
          }
          resolve(chunks);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      // Handle text files
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const lines = content.split('\n').map(line => [line]);
          
          for (let i = 0; i < lines.length; i += linesPerChunk) {
            const rawChunk = lines.slice(i, i + linesPerChunk);
            const sanitizedChunk = sanitizer.sanitize(rawChunk) as string[][];
            
            const chunk: Chunk = {
              data: sanitizedChunk,
              index: chunkIndex++,
              total: Math.ceil(lines.length / linesPerChunk),
              type: 'lines'
            };

            const validation = await processor.processChunk(chunk, config);
            if (!validation.valid) {
              throw new Error(`Chunk validation failed: ${validation.error}`);
            }

            chunks.push(chunk);
          }
          resolve(chunks);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    }
  });
}

export function getFileTypeConfig(
  file: File,
  customConfigs?: Record<SupportedFileType, FileTypeConfig>
): FileTypeConfig {
  const configs = { ...DEFAULT_CONFIGS, ...customConfigs };
  
  for (const [type, config] of Object.entries(configs)) {
    if (config.mimeTypes.some(mime => {
      if (mime.endsWith('/*')) {
        return file.type.startsWith(mime.slice(0, -2));
      }
      return file.type === mime;
    })) {
      return config;
    }
  }
  
  return configs.other;
}
