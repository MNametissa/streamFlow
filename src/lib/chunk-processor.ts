import { Chunk, ChunkData } from './chunking';
import { FileTypeConfig } from '@/types';

export interface ChunkValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ChunkProcessingProgress {
  processedBytes: number;
  totalBytes: number;
  processedLines: number;
  totalLines: number;
  currentChunk: number;
  totalChunks: number;
  startTime: number;
  processingSpeed: number; // bytes or lines per second
  estimatedTimeRemaining: number;
}

export class ChunkProcessor {
  private progress: ChunkProcessingProgress;
  private onProgressUpdate?: (progress: ChunkProcessingProgress) => void;
  private startTime: number;

  constructor(onProgressUpdate?: (progress: ChunkProcessingProgress) => void) {
    this.onProgressUpdate = onProgressUpdate;
    this.startTime = Date.now();
    this.progress = {
      processedBytes: 0,
      totalBytes: 0,
      processedLines: 0,
      totalLines: 0,
      currentChunk: 0,
      totalChunks: 0,
      startTime: this.startTime,
      processingSpeed: 0,
      estimatedTimeRemaining: 0
    };
  }

  validateChunk(chunk: Chunk, config: FileTypeConfig): ChunkValidationResult {
    const result: ChunkValidationResult = { valid: true, warnings: [] };

    if (chunk.type === 'binary') {
      if (!(chunk.data instanceof Blob)) {
        return { valid: false, error: 'Invalid binary chunk data type' };
      }

      // Validate chunk size
      if (chunk.data.size > config.chunking.value) {
        result.warnings?.push(`Chunk size ${chunk.data.size} exceeds configured size ${config.chunking.value}`);
      }

    } else if (chunk.type === 'lines') {
      if (!Array.isArray(chunk.data)) {
        return { valid: false, error: 'Invalid lines chunk data type' };
      }

      // Validate line count
      if (chunk.data.length > config.chunking.value) {
        result.warnings?.push(`Line count ${chunk.data.length} exceeds configured count ${config.chunking.value}`);
      }

      // Validate data structure
      const invalidLines = this.validateLineStructure(chunk.data);
      if (invalidLines.length > 0) {
        result.warnings?.push(`Invalid data structure in lines: ${invalidLines.join(', ')}`);
      }

      // Check for empty or malformed lines
      const emptyLines = chunk.data.filter(line => line.length === 0 || line.every(cell => cell.trim() === ''));
      if (emptyLines.length > 0) {
        result.warnings?.push(`Found ${emptyLines.length} empty lines`);
      }
    }

    return result;
  }

  private validateLineStructure(lines: string[][]): number[] {
    const invalidLines: number[] = [];
    
    // Check first line for column count (assuming it's the header)
    const expectedColumns = lines[0]?.length || 0;
    
    lines.forEach((line, index) => {
      if (!Array.isArray(line)) {
        invalidLines.push(index);
      } else if (line.length !== expectedColumns) {
        invalidLines.push(index);
      } else if (line.some(cell => typeof cell !== 'string')) {
        invalidLines.push(index);
      }
    });

    return invalidLines;
  }

  async processChunk(chunk: Chunk, config: FileTypeConfig): Promise<ChunkValidationResult> {
    const validation = this.validateChunk(chunk, config);
    
    if (!validation.valid) {
      return validation;
    }

    // Update progress based on chunk type
    if (chunk.type === 'binary' && chunk.data instanceof Blob) {
      this.progress.processedBytes += chunk.data.size;
      if (this.progress.totalBytes === 0) {
        this.progress.totalBytes = chunk.data.size * chunk.total;
      }
    } else if (chunk.type === 'lines' && Array.isArray(chunk.data)) {
      this.progress.processedLines += chunk.data.length;
      if (this.progress.totalLines === 0) {
        this.progress.totalLines = chunk.data.length * chunk.total;
      }
    }

    this.progress.currentChunk = chunk.index + 1;
    this.progress.totalChunks = chunk.total;

    // Calculate processing speed and estimated time
    const elapsedTime = (Date.now() - this.startTime) / 1000; // in seconds
    if (chunk.type === 'binary') {
      this.progress.processingSpeed = this.progress.processedBytes / elapsedTime;
      const remainingBytes = this.progress.totalBytes - this.progress.processedBytes;
      this.progress.estimatedTimeRemaining = remainingBytes / this.progress.processingSpeed;
    } else {
      this.progress.processingSpeed = this.progress.processedLines / elapsedTime;
      const remainingLines = this.progress.totalLines - this.progress.processedLines;
      this.progress.estimatedTimeRemaining = remainingLines / this.progress.processingSpeed;
    }

    this.onProgressUpdate?.(this.progress);

    // Simulate some processing time for demonstration
    await new Promise(resolve => setTimeout(resolve, 10));

    return validation;
  }

  getProgress(): ChunkProcessingProgress {
    return { ...this.progress };
  }

  reset(): void {
    this.startTime = Date.now();
    this.progress = {
      processedBytes: 0,
      totalBytes: 0,
      processedLines: 0,
      totalLines: 0,
      currentChunk: 0,
      totalChunks: 0,
      startTime: this.startTime,
      processingSpeed: 0,
      estimatedTimeRemaining: 0
    };
  }
}
