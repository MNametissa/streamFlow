import { ErrorType, ErrorSeverity, ErrorContext, ErrorReport, RetryStrategy } from '@/types';

export class ErrorManager {
  private static readonly MAX_ERROR_HISTORY = 50;
  private errorHistory: ErrorReport[] = [];
  private retryStrategies: Map<ErrorType, RetryStrategy> = new Map();
  private errorCallbacks: Set<(error: ErrorReport) => void> = new Set();

  constructor() {
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies(): void {
    // Network errors
    this.retryStrategies.set('network', {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      strategy: 'exponential',
      conditions: {
        skipIfErrorIncludes: ['QUOTA_EXCEEDED', 'PERMISSION_DENIED']
      }
    });

    // Server errors (5xx)
    this.retryStrategies.set('server', {
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 10000,
      strategy: 'linear',
      conditions: {
        skipIfErrorIncludes: ['NOT_FOUND', 'INVALID_ARGUMENT']
      }
    });

    // Validation errors
    this.retryStrategies.set('validation', {
      maxRetries: 2,
      baseDelay: 0,
      maxDelay: 1000,
      strategy: 'immediate',
      conditions: {
        requiresUserAction: true
      }
    });

    // Storage errors
    this.retryStrategies.set('storage', {
      maxRetries: 3,
      baseDelay: 500,
      maxDelay: 5000,
      strategy: 'exponential',
      conditions: {
        skipIfErrorIncludes: ['QUOTA_EXCEEDED']
      }
    });
  }

  private categorizeError(error: Error): ErrorType {
    const errorMessage = error.message.toLowerCase();
    
    if (error.name === 'NetworkError' || 
        errorMessage.includes('network') ||
        errorMessage.includes('offline') ||
        errorMessage.includes('connection')) {
      return 'network';
    }

    if (errorMessage.includes('server') ||
        errorMessage.includes('5') ||
        errorMessage.includes('timeout')) {
      return 'server';
    }

    if (errorMessage.includes('validation') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('format')) {
      return 'validation';
    }

    if (errorMessage.includes('storage') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('space')) {
      return 'storage';
    }

    return 'unknown';
  }

  private assessSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    const type = this.categorizeError(error);
    
    if (context.isRecoverable === false) {
      return 'critical';
    }

    if (type === 'network' && context.retryCount < 3) {
      return 'warning';
    }

    if (type === 'validation') {
      return 'error';
    }

    if (context.retryCount >= 5) {
      return 'critical';
    }

    return 'error';
  }

  private calculateNextRetryDelay(
    strategy: RetryStrategy,
    attempt: number
  ): number {
    const { baseDelay, maxDelay, strategy: retryType } = strategy;

    let delay: number;
    switch (retryType) {
      case 'immediate':
        delay = 0;
        break;
      case 'linear':
        delay = baseDelay * attempt;
        break;
      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt - 1);
        break;
      case 'fibonacci':
        delay = this.getFibonacciNumber(attempt) * baseDelay;
        break;
      default:
        delay = baseDelay;
    }

    return Math.min(delay, maxDelay);
  }

  private getFibonacciNumber(n: number): number {
    let prev = 0, curr = 1;
    for (let i = 0; i < n; i++) {
      const temp = curr;
      curr = prev + curr;
      prev = temp;
    }
    return prev;
  }

  async handleError(
    error: Error,
    context: ErrorContext
  ): Promise<{ shouldRetry: boolean; retryDelay: number }> {
    const errorType = this.categorizeError(error);
    const severity = this.assessSeverity(error, context);
    const strategy = this.retryStrategies.get(errorType);

    const errorReport: ErrorReport = {
      error,
      type: errorType,
      severity,
      context,
      timestamp: Date.now(),
      stackTrace: error.stack,
      recommendation: this.getErrorRecommendation(error, errorType)
    };

    this.logError(errorReport);

    if (!strategy) {
      return { shouldRetry: false, retryDelay: 0 };
    }

    // Check if we should skip retry based on conditions
    if (strategy.conditions) {
      const { skipIfErrorIncludes, requiresUserAction } = strategy.conditions;

      if (skipIfErrorIncludes?.some(skip => error.message.includes(skip))) {
        return { shouldRetry: false, retryDelay: 0 };
      }

      if (requiresUserAction) {
        this.notifyError(errorReport);
        return { shouldRetry: false, retryDelay: 0 };
      }
    }

    // Check if we've exceeded max retries
    if (context.retryCount >= strategy.maxRetries) {
      return { shouldRetry: false, retryDelay: 0 };
    }

    const retryDelay = this.calculateNextRetryDelay(strategy, context.retryCount + 1);
    return { shouldRetry: true, retryDelay };
  }

  private getErrorRecommendation(error: Error, type: ErrorType): string {
    switch (type) {
      case 'network':
        return 'Check your internet connection and try again.';
      case 'server':
        return 'The server is experiencing issues. Please try again later.';
      case 'validation':
        return 'Please check your input and try again.';
      case 'storage':
        return 'Free up some space and try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private logError(errorReport: ErrorReport): void {
    this.errorHistory.push(errorReport);
    if (this.errorHistory.length > ErrorManager.MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('StreamFlow Error:', {
        type: errorReport.type,
        severity: errorReport.severity,
        message: errorReport.error.message,
        context: errorReport.context,
        recommendation: errorReport.recommendation
      });
    }

    this.notifyError(errorReport);
  }

  private notifyError(errorReport: ErrorReport): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorReport);
      } catch (e) {
        console.error('Error in error callback:', e);
      }
    });
  }

  onError(callback: (error: ErrorReport) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  getErrorHistory(): ErrorReport[] {
    return [...this.errorHistory];
  }

  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  addRetryStrategy(type: ErrorType, strategy: RetryStrategy): void {
    this.retryStrategies.set(type, strategy);
  }

  removeRetryStrategy(type: ErrorType): void {
    this.retryStrategies.delete(type);
  }

  getRetryStrategies(): Map<ErrorType, RetryStrategy> {
    return new Map(this.retryStrategies);
  }
}
