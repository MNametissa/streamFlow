import { MemoryConfig, MemoryStats, ResourceType, MemoryThresholds } from '@/types';

export class MemoryManager {
  private config: Required<MemoryConfig>;
  private resources: Map<string, WeakRef<any>>;
  private registry: FinalizationRegistry<string>;
  private memoryStats: MemoryStats;
  private gcCallbacks: Set<() => void>;
  private lastCleanup: number;
  private memoryThresholds: MemoryThresholds;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: MemoryConfig = {}) {
    this.config = {
      maxMemoryUsage: config.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      cleanupInterval: config.cleanupInterval || 30000, // 30 seconds
      enableAutoCleanup: config.enableAutoCleanup ?? true,
      thresholds: config.thresholds || {
        warning: 0.7, // 70% of max memory
        critical: 0.9  // 90% of max memory
      }
    };

    this.resources = new Map();
    this.registry = new FinalizationRegistry(this.handleResourceCleanup.bind(this));
    this.gcCallbacks = new Set();
    this.lastCleanup = Date.now();
    
    this.memoryStats = {
      totalAllocated: 0,
      activeResources: 0,
      peakMemoryUsage: 0,
      lastGC: Date.now(),
      resourceStats: new Map()
    };

    this.memoryThresholds = {
      warning: this.config.maxMemoryUsage * this.config.thresholds.warning,
      critical: this.config.maxMemoryUsage * this.config.thresholds.critical
    };

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  private startAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.cleanupInterval);
  }

  private async checkMemoryUsage(): Promise<void> {
    const currentMemory = this.memoryStats.totalAllocated;
    
    if (currentMemory > this.memoryThresholds.critical) {
      await this.forceCleanup('critical');
    } else if (currentMemory > this.memoryThresholds.warning) {
      await this.forceCleanup('warning');
    }

    // Update peak memory usage
    this.memoryStats.peakMemoryUsage = Math.max(
      this.memoryStats.peakMemoryUsage,
      currentMemory
    );
  }

  private async forceCleanup(level: 'warning' | 'critical'): Promise<void> {
    // Notify GC callbacks
    this.gcCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in GC callback:', error);
      }
    });

    // Clear expired resources
    for (const [id, ref] of this.resources.entries()) {
      const resource = ref.deref();
      if (!resource) {
        this.resources.delete(id);
        continue;
      }

      if (level === 'critical' && this.isDisposable(resource)) {
        try {
          await this.disposeResource(resource);
          this.resources.delete(id);
        } catch (error) {
          console.error(`Error disposing resource ${id}:`, error);
        }
      }
    }

    // Force garbage collection if available (only in Node.js)
    if (global.gc) {
      global.gc();
    }

    this.lastCleanup = Date.now();
    this.memoryStats.lastGC = Date.now();
  }

  private isDisposable(resource: any): resource is { dispose: () => Promise<void> } {
    return resource && typeof resource.dispose === 'function';
  }

  private async disposeResource(resource: { dispose: () => Promise<void> }): Promise<void> {
    await resource.dispose();
  }

  private handleResourceCleanup(id: string): void {
    const resourceStats = this.memoryStats.resourceStats.get(id);
    if (resourceStats) {
      this.memoryStats.totalAllocated -= resourceStats.size;
      this.memoryStats.activeResources--;
      this.memoryStats.resourceStats.delete(id);
    }
  }

  trackResource(
    resource: any,
    type: ResourceType,
    metadata: { size: number; [key: string]: any }
  ): string {
    const id = crypto.randomUUID();
    const ref = new WeakRef(resource);
    
    this.resources.set(id, ref);
    this.registry.register(resource, id);

    this.memoryStats.totalAllocated += metadata.size;
    this.memoryStats.activeResources++;
    this.memoryStats.resourceStats.set(id, {
      type,
      size: metadata.size,
      createdAt: Date.now(),
      metadata
    });

    return id;
  }

  async releaseResource(id: string): Promise<void> {
    const ref = this.resources.get(id);
    if (!ref) return;

    const resource = ref.deref();
    if (resource && this.isDisposable(resource)) {
      await this.disposeResource(resource);
    }

    this.resources.delete(id);
    this.handleResourceCleanup(id);
  }

  getResourceStats(id: string) {
    return this.memoryStats.resourceStats.get(id);
  }

  getMemoryStats(): MemoryStats {
    return { ...this.memoryStats };
  }

  onBeforeGC(callback: () => void): () => void {
    this.gcCallbacks.add(callback);
    return () => this.gcCallbacks.delete(callback);
  }

  async cleanup(): Promise<void> {
    await this.forceCleanup('critical');
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.resources.clear();
    this.gcCallbacks.clear();
  }
}
