# Security Guide

## Overview

Streamflow provides comprehensive security features to protect your file uploads. This guide covers best practices and implementation details for securing your uploads.

## Security Features

### 1. File Validation

#### MIME Type Validation
```typescript
const config = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  validateFileSignature: true
};
```

- Validates MIME types against allowed list
- Checks actual file signatures
- Prevents MIME type spoofing

#### Size Limits
```typescript
const config = {
  maxFileSize: 10 * 1024 * 1024 // 10MB
};
```

- Prevents denial of service attacks
- Controls storage usage
- Configurable per file type

#### Extension Validation
```typescript
const config = {
  allowedExtensions: ['.jpg', '.png', '.pdf']
};
```

- Whitelist of allowed extensions
- Case-insensitive matching
- Prevents dangerous file types

### 2. Access Control

#### Token-based Authentication
```typescript
// Generate token
const token = manager.securityManager.generateAccessToken('user123');

// Use token
await manager.startStreaming(file, '/api/upload', {
  userId: 'user123',
  accessToken: token
});
```

- Secure token generation
- Configurable expiration
- Per-user token limits

#### Rate Limiting
```typescript
const config = {
  rateLimit: {
    enabled: true,
    maxRequestsPerMinute: 30,
    maxConcurrentUploads: 3
  }
};
```

- Prevents abuse
- Per-user limits
- Concurrent upload limits

### 3. Encryption

#### Chunk Encryption
```typescript
const config = {
  encryption: {
    enabled: true,
    algorithm: 'AES-GCM',
    keySize: 256
  }
};
```

- AES-GCM encryption
- Per-chunk encryption
- Secure key management

#### Implementation Details
- Unique IV per chunk
- Key rotation support
- Secure key storage

### 4. Malware Protection

#### Basic Virus Scanning
```typescript
const config = {
  enableVirusScan: true
};
```

- Pattern-based detection
- File signature analysis
- Executable detection

#### Content Sanitization
- HTML stripping
- Metadata removal
- Format validation

## Best Practices

### 1. Configuration

```typescript
const securityConfig = {
  // File Validation
  maxFileSize: 50 * 1024 * 1024,
  allowedMimeTypes: ['image/*', 'application/pdf'],
  allowedExtensions: ['.jpg', '.png', '.pdf'],
  validateFileSignature: true,
  enableVirusScan: true,

  // Encryption
  encryption: {
    enabled: true,
    algorithm: 'AES-GCM',
    keySize: 256
  },

  // Rate Limiting
  rateLimit: {
    enabled: true,
    maxRequestsPerMinute: 30,
    maxConcurrentUploads: 3
  },

  // Access Control
  accessControl: {
    enabled: true,
    tokenExpiration: 3600,
    maxTokensPerUser: 5
  }
};
```

### 2. Token Management

```typescript
// Generate token with appropriate expiration
const token = manager.securityManager.generateAccessToken(userId);

// Validate token before use
if (!manager.securityManager.validateAccessToken(token)) {
  throw new Error('Invalid or expired token');
}

// Revoke token when needed
manager.securityManager.revokeAccessToken(token);
```

### 3. Error Handling

```typescript
try {
  await manager.startStreaming(file, '/api/upload', options);
} catch (error) {
  if (error.code === 'INVALID_TOKEN') {
    // Handle authentication error
  } else if (error.code === 'INVALID_FILE') {
    // Handle validation error
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limit error
  }
}
```

### 4. Cleanup

```typescript
// Always dispose of managers when done
manager.dispose();

// Clear sensitive data
manager.securityManager.revokeAllTokens();
```

## Security Checklist

- [ ] Configure allowed file types
- [ ] Set appropriate size limits
- [ ] Enable file signature validation
- [ ] Configure rate limiting
- [ ] Implement access control
- [ ] Enable encryption
- [ ] Set up virus scanning
- [ ] Implement proper error handling
- [ ] Regular security audits
- [ ] Monitor upload patterns

## Common Vulnerabilities

1. **MIME Type Spoofing**
   - Always validate actual file content
   - Use file signature checking
   - Don't trust client-provided MIME types

2. **Denial of Service**
   - Implement rate limiting
   - Set appropriate size limits
   - Monitor resource usage

3. **Unauthorized Access**
   - Use token-based authentication
   - Implement proper access control
   - Regular token rotation

4. **Data Exposure**
   - Enable encryption
   - Secure key management
   - Proper cleanup of sensitive data

## Integration with External Security Tools

### Virus Scanning
```typescript
// Example integration with ClamAV
const config = {
  virusScan: {
    enabled: true,
    service: 'clamav',
    endpoint: 'http://localhost:3310'
  }
};
```

### Authentication Services
```typescript
// Example integration with Auth0
const config = {
  auth: {
    provider: 'auth0',
    domain: 'your-domain.auth0.com',
    clientId: 'your-client-id'
  }
};
```

## Monitoring and Logging

### Security Events
```typescript
manager.on('securityEvent', (event) => {
  console.log('Security event:', event.type, event.details);
});
```

### Audit Trail
```typescript
manager.on('audit', (entry) => {
  // Log security-relevant actions
  saveAuditLog(entry);
});
```

## Additional Resources

- [OWASP File Upload Security Guide](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Web Crypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
