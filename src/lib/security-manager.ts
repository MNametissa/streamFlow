import { SecurityConfig, FileValidationResult, RateLimitInfo, FileSignature } from '@/types';
import { ErrorManager } from './error-manager';

export class SecurityManager {
  private config: Required<SecurityConfig>;
  private errorManager: ErrorManager;
  private rateLimits: Map<string, RateLimitInfo>;
  private activeTokens: Set<string>;
  private fileSignatures: Map<string, FileSignature[]>;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: config.allowedMimeTypes || ['*/*'],
      allowedExtensions: config.allowedExtensions || ['*'],
      validateFileSignature: config.validateFileSignature ?? true,
      enableVirusScan: config.enableVirusScan ?? true,
      encryption: {
        enabled: config.encryption?.enabled ?? true,
        algorithm: config.encryption?.algorithm || 'AES-GCM',
        keySize: config.encryption?.keySize || 256
      },
      rateLimit: {
        enabled: config.rateLimit?.enabled ?? true,
        maxRequestsPerMinute: config.rateLimit?.maxRequestsPerMinute || 60,
        maxConcurrentUploads: config.rateLimit?.maxConcurrentUploads || 3
      },
      accessControl: {
        enabled: config.accessControl?.enabled ?? true,
        tokenExpiration: config.accessControl?.tokenExpiration || 3600,
        maxTokensPerUser: config.accessControl?.maxTokensPerUser || 5
      }
    };

    this.errorManager = new ErrorManager();
    this.rateLimits = new Map();
    this.activeTokens = new Set();
    this.fileSignatures = new Map([
      ['image/jpeg', [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }]],
      ['image/png', [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }]],
      ['image/gif', [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }]],
      ['application/pdf', [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }]]
    ]);
  }

  private async validateFileSignature(file: File): Promise<boolean> {
    const signatures = this.fileSignatures.get(file.type);
    if (!signatures) return true; // No signature check for unknown types

    const buffer = await file.slice(0, 50).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    return signatures.some(sig => {
      const signatureBytes = new Uint8Array(sig.bytes);
      return signatureBytes.every((byte, i) => byte === bytes[sig.offset + i]);
    });
  }

  private async scanForVirus(file: File): Promise<boolean> {
    if (!this.config.enableVirusScan) return true;

    try {
      // Integration with ClamAV or similar
      // This is a placeholder for actual virus scanning implementation
      const chunkSize = 1024 * 1024; // 1MB chunks
      let offset = 0;
      
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        const buffer = await chunk.arrayBuffer();
        
        // Here you would send the buffer to your virus scanning service
        // For now, we'll just check for obvious malicious patterns
        const bytes = new Uint8Array(buffer);
        const suspiciousPatterns = [
          [0x4D, 0x5A], // EXE header
          [0x7F, 0x45, 0x4C, 0x46], // ELF header
          // Add more signatures as needed
        ];

        for (const pattern of suspiciousPatterns) {
          if (bytes.length >= pattern.length) {
            const matches = pattern.every((byte, i) => byte === bytes[i]);
            if (matches) return false; // Potential threat found
          }
        }

        offset += chunkSize;
      }

      return true;
    } catch (error) {
      console.error('Virus scan error:', error);
      return false;
    }
  }

  async validateFile(file: File): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      errors: []
    };

    // Check file size
    if (file.size > this.config.maxFileSize) {
      result.isValid = false;
      result.errors.push(`File size ${file.size} exceeds maximum allowed size ${this.config.maxFileSize}`);
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes('*/*') && 
        !this.config.allowedMimeTypes.includes(file.type)) {
      result.isValid = false;
      result.errors.push(`File type ${file.type} is not allowed`);
    }

    // Check extension
    const extension = `.${file.name.split('.').pop()}`;
    if (!this.config.allowedExtensions.includes('*') && 
        !this.config.allowedExtensions.includes(extension)) {
      result.isValid = false;
      result.errors.push(`File extension ${extension} is not allowed`);
    }

    // Validate file signature
    if (this.config.validateFileSignature) {
      const validSignature = await this.validateFileSignature(file);
      if (!validSignature) {
        result.isValid = false;
        result.errors.push('File signature validation failed');
      }
    }

    // Scan for viruses
    if (this.config.enableVirusScan) {
      const clean = await this.scanForVirus(file);
      if (!clean) {
        result.isValid = false;
        result.errors.push('File failed virus scan');
      }
    }

    return result;
  }

  async generateEncryptionKey(): Promise<CryptoKey> {
    const algorithm = {
      name: this.config.encryption.algorithm ?? '',
      length: this.config.encryption.keySize ?? ''
    };

    return (await crypto.subtle.generateKey(
      algorithm,
      true,
      ['encrypt', 'decrypt']
    )) as CryptoKey;
  }

  async encryptChunk(chunk: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: this.config.encryption.algorithm ?? '',
        iv
      },
      key,
      chunk
    );

    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encryptedData.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedData), iv.length);
    
    return result.buffer;
  }

  async decryptChunk(encryptedChunk: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
    const iv = encryptedChunk.slice(0, 12);
    const data = encryptedChunk.slice(12);

    return await crypto.subtle.decrypt(
      {
        name: this.config.encryption.algorithm ?? '',
        iv
      },
      key,
      data
    );
  }

  checkRateLimit(userId: string): boolean {
    if (!this.config.rateLimit.enabled) return true;

    const now = Date.now();
    const userLimit = this.rateLimits.get(userId) || {
      requests: [],
      concurrentUploads: 0
    };

    // Clean up old requests
    userLimit.requests = userLimit.requests.filter(
      time => now - time < 60000 // 1 minute
    );

    if (typeof this.config.rateLimit.maxRequestsPerMinute === 'number' && 
        userLimit.requests.length >= this.config.rateLimit.maxRequestsPerMinute) {
      return false;
    }

    if (typeof this.config.rateLimit.maxConcurrentUploads === 'number' && 
        userLimit.concurrentUploads >= this.config.rateLimit.maxConcurrentUploads) {
      return false;
    }

    userLimit.requests.push(now);
    userLimit.concurrentUploads++;
    this.rateLimits.set(userId, userLimit);

    return true;
  }

  releaseRateLimit(userId: string): void {
    const userLimit = this.rateLimits.get(userId);
    if (userLimit) {
      userLimit.concurrentUploads = Math.max(0, userLimit.concurrentUploads - 1);
      this.rateLimits.set(userId, userLimit);
    }
  }

  generateAccessToken(userId: string): string {
    if (!this.config.accessControl.enabled) return 'disabled';

    const userTokens = Array.from(this.activeTokens)
      .filter(token => token.startsWith(`${userId}:`));

    if (userTokens.length >= (this.config.accessControl.maxTokensPerUser ?? 0)) {
      // Remove oldest token
      const oldestToken = userTokens[0];
      this.activeTokens.delete(oldestToken);
    }

    const token = `${userId}:${crypto.randomUUID()}:${Date.now()}`;
    this.activeTokens.add(token);

    // Schedule token expiration
    setTimeout(() => {
      this.activeTokens.delete(token);
    }, this.config.accessControl.tokenExpiration ?? 0 * 1000);

    return token;
  }

  validateAccessToken(token: string): boolean {
    if (!this.config.accessControl.enabled) return true;
    if (!token) return false;

    if (!this.activeTokens.has(token)) return false;

    const [, , timestamp] = token.split(':');
    const tokenAge = Date.now() - Number(timestamp);

    if (tokenAge > (this.config.accessControl.tokenExpiration ?? 0) * 1000) {
      this.activeTokens.delete(token);
      return false;
    }

    return true;
  }

  revokeAccessToken(token: string): void {
    this.activeTokens.delete(token);
  }

  get securityConfig(): Readonly<Required<SecurityConfig>> {
    return Object.freeze({ ...this.config });
  }

  dispose(): void {
    this.rateLimits.clear();
    this.activeTokens.clear();
  }
}
