import { Chunk, ChunkData } from './chunking';
import { ChunkCompressor, CompressedChunk, CompressionStats } from './chunk-compressor';

interface CacheEntry {
  chunk: CompressedChunk;
  timestamp: number;
  hash: string;
}

interface CacheStats {
  size: number;
  oldestEntry: number;
  newestEntry: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  averageCompressionRatio: number;
  compressionSavings: number;
}

export class ChunkCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private maxAge: number;
  private compressor: ChunkCompressor;

  constructor(maxSize: number = 100, maxAge: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.compressor = new ChunkCompressor();
  }

  private generateHash(chunk: Chunk | CompressedChunk): string {
    const content = chunk.type === 'binary' 
      ? (chunk.data as Blob).size.toString() + chunk.index
      : JSON.stringify(chunk.data) + chunk.index;
    
    return Array.from(content)
      .reduce((hash, char) => {
        return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
      }, 0)
      .toString(36);
  }

  async set(key: string, chunk: Chunk): Promise<void> {
    // Clean expired entries first
    this.cleanExpired();

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    // Compress the chunk if it's large enough
    const shouldCompress = await this.compressor.shouldCompress(chunk);
    const compressedChunk = shouldCompress 
      ? await this.compressor.compress(chunk)
      : { ...chunk, compressed: false };

    this.cache.set(key, {
      chunk: compressedChunk,
      timestamp: Date.now(),
      hash: this.generateHash(compressedChunk)
    });
  }

  async get(key: string): Promise<Chunk | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Verify hash to ensure data integrity
    const currentHash = this.generateHash(entry.chunk);
    if (currentHash !== entry.hash) {
      this.cache.delete(key);
      return null;
    }

    // Decompress if necessary
    return entry.chunk.compressed 
      ? this.compressor.decompress(entry.chunk)
      : entry.chunk;
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    entries.forEach(entry => {
      if (entry.chunk.compressionStats) {
        totalOriginalSize += entry.chunk.compressionStats.originalSize;
        totalCompressedSize += entry.chunk.compressionStats.compressedSize;
      }
    });

    const averageCompressionRatio = entries.length > 0
      ? entries.reduce((sum, entry) => 
          sum + (entry.chunk.compressionStats?.compressionRatio || 100), 0
        ) / entries.length
      : 100;

    return {
      size: this.cache.size,
      oldestEntry: entries.length ? Math.min(...entries.map(e => e.timestamp)) : 0,
      newestEntry: entries.length ? Math.max(...entries.map(e => e.timestamp)) : 0,
      totalOriginalSize,
      totalCompressedSize,
      averageCompressionRatio,
      compressionSavings: totalOriginalSize - totalCompressedSize
    };
  }
}
