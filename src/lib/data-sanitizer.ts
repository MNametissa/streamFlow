import { ChunkData } from './chunking';
import DOMPurify from 'dompurify';

export interface SanitizationOptions {
  removeHtml: boolean;
  trimWhitespace: boolean;
  normalizeNewlines: boolean;
  removeControlChars: boolean;
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

const DEFAULT_OPTIONS: SanitizationOptions = {
  removeHtml: true,
  trimWhitespace: true,
  normalizeNewlines: true,
  removeControlChars: true,
  maxLength: undefined,
  allowedTags: [],
  allowedAttributes: []
};

export class DataSanitizer {
  private options: SanitizationOptions;

  constructor(options: Partial<SanitizationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  sanitize(data: ChunkData): ChunkData {
    if (data instanceof Blob) {
      return data; // Binary data doesn't need sanitization
    }

    return data.map(row => row.map(cell => this.sanitizeCell(cell)));
  }

  private sanitizeCell(value: string): string {
    if (!value) return value;

    let sanitized = value;

    // Remove HTML if needed
    if (this.options.removeHtml) {
      sanitized = this.options.allowedTags?.length 
        ? DOMPurify.sanitize(sanitized, {
            ALLOWED_TAGS: this.options.allowedTags,
            ALLOWED_ATTR: this.options.allowedAttributes
          })
        : DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
    }

    // Trim whitespace
    if (this.options.trimWhitespace) {
      sanitized = sanitized.trim();
    }

    // Normalize newlines
    if (this.options.normalizeNewlines) {
      sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    // Remove control characters
    if (this.options.removeControlChars) {
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    // Truncate if needed
    if (this.options.maxLength !== undefined && sanitized.length > this.options.maxLength) {
      sanitized = sanitized.slice(0, this.options.maxLength);
    }

    return sanitized;
  }

  sanitizeFileName(fileName: string): string {
    // Remove any directory traversal attempts
    let sanitized = fileName.replace(/^.*[\\\/]/, '');
    
    // Remove any non-printable characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');
    
    // Ensure the filename isn't too long
    if (sanitized.length > 255) {
      const ext = sanitized.split('.').pop() || '';
      sanitized = sanitized.slice(0, 255 - ext.length - 1) + '.' + ext;
    }
    
    return sanitized;
  }

  sanitizeMimeType(mimeType: string): string {
    // Only allow valid MIME type format
    if (/^[a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+$/.test(mimeType)) {
      return mimeType.toLowerCase();
    }
    return 'application/octet-stream'; // Default to binary
  }

  validateAndSanitizeJSON(jsonString: string): object | null {
    try {
      // First, try to parse the JSON
      const parsed = JSON.parse(jsonString);
      
      // Deep sanitize the object
      const sanitize = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) {
          return typeof obj === 'string' ? this.sanitizeCell(obj) : obj;
        }
        
        if (Array.isArray(obj)) {
          return obj.map(item => sanitize(item));
        }
        
        const result: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(obj)) {
          const sanitizedKey = this.sanitizeCell(key);
          result[sanitizedKey] = sanitize(value);
        }
        return result;
      };
      
      return sanitize(parsed);
    } catch {
      return null;
    }
  }

  sanitizeCSVField(field: string): string {
    let sanitized = this.sanitizeCell(field);
    
    // Handle CSV injection attempts
    if (sanitized.startsWith('=') || sanitized.startsWith('+') || sanitized.startsWith('-') || sanitized.startsWith('@')) {
      sanitized = `'${sanitized}`; // Prevent formula injection
    }
    
    // Escape double quotes and wrap in quotes if necessary
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
      sanitized = `"${sanitized.replace(/"/g, '""')}"`;
    }
    
    return sanitized;
  }
}
