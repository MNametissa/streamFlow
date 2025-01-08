# Streamflow

A powerful, secure, and memory-efficient file upload library for modern web applications.

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)]()
[![Memory Safe](https://img.shields.io/badge/Memory-Optimized-orange.svg)]()

## Features

### Core Upload Capabilities
- 🚀 Streaming uploads with chunk-based processing
- 📊 Real-time progress tracking
- ⏯️ Pause/Resume functionality
- 🔄 Concurrent upload support
- 🔁 Automatic retry mechanism
- 💾 Memory-efficient operations

### Security
- 🔒 File validation and sanitization
- 🛡️ Access control with token-based authentication
- 🚦 Rate limiting and DDoS protection
- 🔐 AES-GCM encryption
- 📝 File signature verification
- 🦠 Basic malware detection

### Performance
- 🧵 Worker thread support
- 📦 Automatic compression
- 🧹 Smart memory management
- ♻️ Automatic resource cleanup
- 🎯 Optimized chunking strategies

### Memory Management
- 📊 Memory usage tracking
- 🔄 Automatic garbage collection
- ⚡ Resource optimization
- 🎚️ Configurable thresholds
- 🏷️ Resource tagging

## Installation

```bash
npm install @streamflow/core
```

## Quick Start

```typescript
import { StreamUploadManager } from '@streamflow/core';

// Initialize with default configuration
const manager = new StreamUploadManager();

// Start a basic upload
try {
  await manager.startStreaming(file, '/api/upload', {
    onProgress: (progress) => console.log(`Upload: ${progress.percentage}%`),
    userId: 'user123',
    accessToken: 'your-access-token'
  });
} catch (error) {
  console.error('Upload failed:', error.message);
}
```

## Advanced Configuration

### Complete Configuration Example
```typescript
const manager = new StreamUploadManager({
  // Upload Configuration
  chunkSize: 1024 * 1024, // 1MB chunks
  concurrentStreams: 3,
  compressionEnabled: true,
  validateChunks: true,
  retryAttempts: 3,
  workerConfig: {
    maxWorkers: 4,
    taskTimeout: 30000
  }
}, {
  // Memory Configuration
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  cleanupInterval: 30000,
  enableAutoCleanup: true,
  thresholds: {
    warning: 0.7,  // 70% of max memory
    critical: 0.9  // 90% of max memory
  }
}, {
  // Security Configuration
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['image/*', 'application/pdf'],
  allowedExtensions: ['.jpg', '.png', '.pdf'],
  validateFileSignature: true,
  enableVirusScan: true,
  encryption: {
    enabled: true,
    algorithm: 'AES-GCM',
    keySize: 256
  },
  rateLimit: {
    enabled: true,
    maxRequestsPerMinute: 30,
    maxConcurrentUploads: 3
  },
  accessControl: {
    enabled: true,
    tokenExpiration: 3600,
    maxTokensPerUser: 5
  }
});
```

## Security Best Practices

### Access Control
```typescript
// Generate a secure access token
const token = manager.securityManager.generateAccessToken('user123');

// Use the token for uploads
await manager.startStreaming(file, '/api/upload', {
  userId: 'user123',
  accessToken: token
});
```

### File Validation
```typescript
// Configure allowed file types
const config = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.png', '.pdf'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  validateFileSignature: true
};
```

## Memory Management

### Monitoring Memory Usage
```typescript
// Get current memory stats
const stats = manager.getMemoryStats();
console.log('Memory usage:', stats.totalAllocated / 1024 / 1024, 'MB');
console.log('Active resources:', stats.activeResources);
```

### Cleanup
```typescript
// Manual cleanup
manager.dispose();
```

## Error Handling

```typescript
try {
  await manager.startStreaming(file, '/api/upload', options);
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log('Please wait before uploading more files');
  } else if (error.code === 'INVALID_FILE') {
    console.log('File validation failed:', error.message);
  } else if (error.code === 'MEMORY_LIMIT_EXCEEDED') {
    console.log('System is busy, try again later');
  }
}
```

## Events and Progress Tracking

```typescript
manager.startStreaming(file, '/api/upload', {
  onProgress: (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
    console.log(`Speed: ${progress.speed} MB/s`);
    console.log(`Remaining time: ${progress.estimatedTimeRemaining}s`);
    console.log(`Processed: ${progress.bytesUploaded} / ${progress.totalBytes}`);
  }
});
```

## Browser Support

- ✅ Chrome 76+
- ✅ Firefox 69+
- ✅ Safari 14.1+
- ✅ Edge 79+

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](docs/README.md)
- 💬 [Discord Community](https://discord.gg/streamflow)
- 🐛 [Issue Tracker](https://github.com/streamflow/streamflow/issues)
- 📧 [Email Support](mailto:support@streamflow.dev)
