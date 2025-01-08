# Streamflow Documentation

Welcome to the Streamflow documentation! This guide will help you understand and implement our powerful file upload library.

## Table of Contents

1. [Getting Started](./getting-started.md)
2. [Core Concepts](./core-concepts.md)
3. [API Reference](./api-reference/README.md)
4. [Security Guide](./security-guide.md)
5. [Performance Optimization](./performance.md)
6. [Memory Management](./memory-management.md)
7. [Error Handling](./error-handling.md)
8. [Examples](./examples/README.md)
9. [Troubleshooting](./troubleshooting.md)
10. [Migration Guide](./migration-guide.md)

## Quick Links

- [Installation Guide](./getting-started.md#installation)
- [Basic Usage](./getting-started.md#basic-usage)
- [Configuration Options](./api-reference/configuration.md)
- [Security Best Practices](./security-guide.md#best-practices)
- [Performance Tips](./performance.md#optimization-tips)
- [Common Issues](./troubleshooting.md#common-issues)

## Core Components

### StreamUploadManager
The main class that handles file uploads. It coordinates between different managers and provides a simple interface for file uploads.

### SecurityManager
Handles all security-related functionality including file validation, access control, and encryption.

### MemoryManager
Manages memory usage, resource tracking, and cleanup to prevent memory leaks and optimize performance.

### WorkerManager
Manages Web Worker threads for parallel processing of tasks like compression and validation.

### ErrorManager
Provides comprehensive error handling and reporting functionality.

## Getting Help

- Check our [Troubleshooting Guide](./troubleshooting.md)
- Join our [Discord Community](https://discord.gg/streamflow)
- Open an issue on [GitHub](https://github.com/streamflow/streamflow/issues)
- Contact [Support](mailto:support@streamflow.dev)
