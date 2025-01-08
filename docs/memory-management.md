# Memory Management Guide

## Overview

Streamflow includes a sophisticated memory management system to prevent memory leaks and optimize resource usage during file uploads.

## Key Features

### 1. Resource Tracking

```typescript
interface ResourceStats {
  type: ResourceType;
  size: number;
  createdAt: number;
  metadata: Record<string, any>;
}
```

- Tracks all allocated resources
- Monitors resource lifecycle
- Automatic cleanup of unused resources

### 2. Memory Thresholds

```typescript
const config = {
  thresholds: {
    warning: 0.7,  // 70% of max memory
    critical: 0.9  // 90% of max memory
  }
};
```

- Warning level alerts
- Critical level handling
- Automatic cleanup triggers

### 3. Garbage Collection

```typescript
class MemoryManager {
  private registry: FinalizationRegistry<string>;
  private resources: Map<string, WeakRef<any>>;
}
```

- WeakRef for resource tracking
- FinalizationRegistry for cleanup
- Automatic GC integration

## Configuration

### Basic Configuration

```typescript
const memoryConfig = {
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  cleanupInterval: 30000, // 30 seconds
  enableAutoCleanup: true,
  thresholds: {
    warning: 0.7,
    critical: 0.9
  }
};

const manager = new StreamUploadManager({}, memoryConfig);
```

### Advanced Configuration

```typescript
const advancedConfig = {
  maxMemoryUsage: 200 * 1024 * 1024,
  cleanupInterval: 15000,
  enableAutoCleanup: true,
  thresholds: {
    warning: 0.6,
    critical: 0.8
  },
  gcCallback: () => {
    console.log('Garbage collection triggered');
  },
  resourceTracking: {
    enabled: true,
    detailed: true,
    metadata: true
  }
};
```

## Memory Monitoring

### Getting Memory Stats

```typescript
const stats = manager.getMemoryStats();
console.log('Total allocated:', stats.totalAllocated);
console.log('Active resources:', stats.activeResources);
console.log('Peak usage:', stats.peakMemoryUsage);
```

### Memory Events

```typescript
manager.on('memoryWarning', (event) => {
  console.log('Memory warning:', event.usage, event.threshold);
});

manager.on('memoryCritical', (event) => {
  console.log('Critical memory usage:', event.usage);
});
```

## Resource Management

### Manual Resource Tracking

```typescript
// Track a resource
const resourceId = manager.memoryManager.trackResource(
  resource,
  'chunk',
  { size: 1024, type: 'image' }
);

// Release a resource
await manager.memoryManager.releaseResource(resourceId);
```

### Automatic Cleanup

```typescript
// Configure automatic cleanup
manager.memoryManager.onBeforeGC(() => {
  // Perform cleanup tasks
});

// Force cleanup
manager.memoryManager.cleanup();
```

## Best Practices

### 1. Memory Configuration

```typescript
const bestConfig = {
  // Set reasonable limits
  maxMemoryUsage: 100 * 1024 * 1024,
  
  // Regular cleanup
  cleanupInterval: 30000,
  enableAutoCleanup: true,
  
  // Conservative thresholds
  thresholds: {
    warning: 0.6,  // Early warning
    critical: 0.8  // Time to act
  }
};
```

### 2. Resource Cleanup

```typescript
// Always cleanup when done
try {
  await uploadFile(file);
} finally {
  manager.dispose();
}

// Release resources ASAP
manager.memoryManager.releaseResource(resourceId);
```

### 3. Memory Monitoring

```typescript
// Regular monitoring
setInterval(() => {
  const stats = manager.getMemoryStats();
  if (stats.totalAllocated > threshold) {
    triggerCleanup();
  }
}, 5000);
```

## Memory Optimization Tips

### 1. Chunk Size Optimization

```typescript
const optimizedConfig = {
  chunkSize: 512 * 1024, // Smaller chunks for better memory usage
  concurrentStreams: 2   // Limit concurrent uploads
};
```

### 2. Resource Lifecycle

```typescript
// Track resource lifecycle
const resourceId = manager.memoryManager.trackResource(chunk);
try {
  await processChunk(chunk);
} finally {
  await manager.memoryManager.releaseResource(resourceId);
}
```

### 3. Memory Leaks Prevention

```typescript
// Use WeakRef for references
const ref = new WeakRef(resource);

// Register for cleanup
registry.register(resource, cleanup);
```

## Troubleshooting

### Common Issues

1. **Memory Leaks**
```typescript
// Check for unreleased resources
const stats = manager.getMemoryStats();
console.log('Unreleased resources:', stats.activeResources);
```

2. **High Memory Usage**
```typescript
// Monitor memory spikes
manager.on('memoryCritical', async () => {
  await manager.memoryManager.cleanup();
  console.log('Emergency cleanup performed');
});
```

3. **Resource Tracking Issues**
```typescript
// Debug resource tracking
manager.memoryManager.debug({
  trackingEnabled: true,
  verbose: true
});
```

## Performance Impact

### Memory vs Performance

```typescript
const balancedConfig = {
  // Balance memory usage and performance
  chunkSize: 1024 * 1024,    // 1MB chunks
  concurrentStreams: 3,       // Moderate concurrency
  compressionEnabled: true,   // Save memory with compression
  cleanupInterval: 30000     // Regular cleanup
};
```

### Monitoring Tools

```typescript
// Performance monitoring
manager.on('performance', (metrics) => {
  console.log('Upload speed:', metrics.speed);
  console.log('Memory usage:', metrics.memoryUsage);
  console.log('Processing time:', metrics.processingTime);
});
```

## Integration Examples

### With React

```typescript
function UploadComponent() {
  useEffect(() => {
    const manager = new StreamUploadManager();
    return () => {
      // Cleanup on unmount
      manager.dispose();
    };
  }, []);
}
```

### With Vue

```typescript
export default {
  mounted() {
    this.manager = new StreamUploadManager();
  },
  beforeDestroy() {
    // Cleanup
    this.manager.dispose();
  }
}
```

## Additional Resources

- [Memory Management in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
- [WeakRef and FinalizationRegistry](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API)
