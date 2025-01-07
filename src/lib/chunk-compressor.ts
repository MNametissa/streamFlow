import { Chunk } from './chunking';
import pako from 'pako';

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
}

export interface CompressedChunk extends Chunk {
  compressed: boolean;
  compressionStats?: CompressionStats;
}

export class ChunkCompressor {
  private async getBlobSize(blob: Blob): Promise<number> {
    return blob.size;
  }

  private async getStringArraySize(data: string[][]): Promise<number> {
    return new Blob([JSON.stringify(data)]).size;
  }

  private async compressBlob(blob: Blob): Promise<{ data: Blob; stats: CompressionStats }> {
    const startTime = performance.now();
    const arrayBuffer = await blob.arrayBuffer();
    const compressed = pako.deflate(new Uint8Array(arrayBuffer));
    const compressedBlob = new Blob([compressed]);
    const endTime = performance.now();

    const stats: CompressionStats = {
      originalSize: blob.size,
      compressedSize: compressedBlob.size,
      compressionRatio: (compressedBlob.size / blob.size) * 100,
      compressionTime: endTime - startTime
    };

    return { data: compressedBlob, stats };
  }

  private async compressStringArray(
    data: string[][]
  ): Promise<{ data: Blob; stats: CompressionStats }> {
    const startTime = performance.now();
    const jsonString = JSON.stringify(data);
    const textEncoder = new TextEncoder();
    const uint8Array = textEncoder.encode(jsonString);
    const compressed = pako.deflate(uint8Array);
    
    const blob = new Blob([compressed], { type: 'application/octet-stream' });
    const endTime = performance.now();

    const stats: CompressionStats = {
      originalSize: uint8Array.length,
      compressedSize: compressed.length,
      compressionRatio: compressed.length / uint8Array.length,
      compressionTime: endTime - startTime
    };

    return { data: blob, stats };
  }

  private async decompressBlob(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const decompressed = pako.inflate(new Uint8Array(arrayBuffer));
    return new Blob([decompressed]);
  }

  private decompressStringArray(compressed: Uint8Array): string[][] {
    const decompressed = pako.inflate(compressed, { to: 'string' });
    return JSON.parse(decompressed);
  }

  async compress(chunk: Chunk): Promise<CompressedChunk> {
    if (chunk.type === 'binary') {
      const blob = chunk.data as Blob;
      const { data, stats } = await this.compressBlob(blob);
      
      return {
        ...chunk,
        data,
        compressed: true,
        compressionStats: stats
      };
    } else {
      const stringArray = chunk.data as string[][];
      const { data, stats } = await this.compressStringArray(stringArray);
      
      return {
        ...chunk,
        data,
        compressed: true,
        compressionStats: stats
      };
    }
  }

  async decompress(chunk: CompressedChunk): Promise<Chunk> {
    if (!chunk.compressed) {
      return chunk;
    }

    if (chunk.type === 'binary') {
      const blob = chunk.data as Blob;
      const decompressedData = await this.decompressBlob(blob);
      
      return {
        ...chunk,
        data: decompressedData
      };
    } else {
      const compressed = chunk.data as Blob;
      const arrayBuffer = await compressed.arrayBuffer();
      const decompressedData = this.decompressStringArray(new Uint8Array(arrayBuffer));
      
      return {
        ...chunk,
        data: decompressedData
      };
    }
  }

  async shouldCompress(chunk: Chunk): Promise<boolean> {
    const MIN_SIZE_FOR_COMPRESSION = 1024; // 1KB
    const size = chunk.type === 'binary'
      ? await this.getBlobSize(chunk.data as Blob)
      : await this.getStringArraySize(chunk.data as string[][]);
    
    return size > MIN_SIZE_FOR_COMPRESSION;
  }

  getCompressionStats(chunk: CompressedChunk): CompressionStats | undefined {
    return chunk.compressionStats;
  }
}
