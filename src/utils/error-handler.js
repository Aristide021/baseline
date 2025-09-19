const core = require('@actions/core');
const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive error handling and resilience utilities
 */
class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      exponentialBackoff: options.exponentialBackoff !== false,
      enableErrorReporting: options.enableErrorReporting !== false,
      errorLogPath: options.errorLogPath || '.baseline-cache/errors.log',
      gracefulDegradation: options.gracefulDegradation !== false,
      ...options
    };
    
    this.errorCounts = new Map();
    this.errorLog = [];
    this.setupGlobalErrorHandlers();
  }

  /**
   * Setup global error handlers for the process
   */
  setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('Uncaught Exception', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleCriticalError('Unhandled Promise Rejection', reason);
    });

    // Handle warnings
    process.on('warning', (warning) => {
      core.debug(`Node.js Warning: ${warning.name}: ${warning.message}`);
      if (warning.stack) {
        core.debug(warning.stack);
      }
    });
  }

  /**
   * Handle critical errors that could crash the process
   * @param {string} type - Error type
   * @param {Error} error - Error object
   */
  handleCriticalError(type, error) {
    this.logError(error, { type, critical: true });
    
    core.error(`${type}: ${error.message}`);
    if (error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }

    // Attempt graceful shutdown
    this.gracefulShutdown();
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options
   * @returns {Promise<*>} Function result
   */
  async withRetry(fn, options = {}) {
    const {
      maxRetries = this.options.maxRetries,
      retryDelay = this.options.retryDelay,
      exponentialBackoff = this.options.exponentialBackoff,
      retryCondition = this.defaultRetryCondition,
      onRetry = null,
      context = 'operation'
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 1) {
          core.info(`${context} succeeded on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (attempt <= maxRetries && retryCondition(error)) {
          const delay = exponentialBackoff ? 
            retryDelay * Math.pow(2, attempt - 1) : 
            retryDelay;
          
          core.warning(`${context} failed (attempt ${attempt}/${maxRetries + 1}): ${error.message}`);
          core.debug(`Retrying in ${delay}ms...`);
          
          if (onRetry) {
            await onRetry(error, attempt);
          }
          
          await this.delay(delay);
        } else {
          break;
        }
      }
    }
    
    // All retries exhausted
    this.logError(lastError, { context, attempts: maxRetries + 1 });
    throw lastError;
  }

  /**
   * Default retry condition - retry on network and temporary errors
   * @param {Error} error - Error to check
   * @returns {boolean} True if should retry
   */
  defaultRetryCondition(error) {
    // Retry on network errors
    if (error.code && ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) {
      return true;
    }
    
    // Retry on HTTP 5xx errors
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    // Retry on rate limiting
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    // Retry on timeout errors
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return true;
    }
    
    return false;
  }

  /**
   * Execute function with timeout
   * @param {Function} fn - Function to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} context - Context for error messages
   * @returns {Promise<*>} Function result or timeout error
   */
  async withTimeout(fn, timeout, context = 'operation') {
    return new Promise(async (resolve, reject) => {
      let completed = false;
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!completed) {
          completed = true;
          const error = new Error(`${context} timed out after ${timeout}ms`);
          error.code = 'TIMEOUT';
          reject(error);
        }
      }, timeout);
      
      try {
        const result = await fn();
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      } catch (error) {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      }
    });
  }

  /**
   * Safe file operations with error handling
   * @param {string} filePath - File path
   * @param {string} operation - Operation type
   * @param {Function} fn - File operation function
   * @returns {Promise<*>} Operation result
   */
  async safeFileOperation(filePath, operation, fn) {
    try {
      return await this.withRetry(
        () => fn(),
        {
          context: `${operation} on ${filePath}`,
          retryCondition: (error) => {
            // Retry on temporary file system errors
            return error.code && ['EBUSY', 'EAGAIN', 'EMFILE', 'ENFILE'].includes(error.code);
          }
        }
      );
    } catch (error) {
      this.handleFileError(error, filePath, operation);
      throw error;
    }
  }

  /**
   * Handle file-specific errors
   * @param {Error} error - File error
   * @param {string} filePath - File path
   * @param {string} operation - Operation attempted
   */
  handleFileError(error, filePath, operation) {
    let errorMessage = `Failed to ${operation} file: ${filePath}`;
    let suggestion = '';
    
    switch (error.code) {
      case 'ENOENT':
        suggestion = 'File or directory does not exist';
        break;
      case 'EACCES':
        suggestion = 'Permission denied - check file permissions';
        break;
      case 'EBUSY':
        suggestion = 'File is busy - it may be open in another process';
        break;
      case 'EMFILE':
      case 'ENFILE':
        suggestion = 'Too many open files - system resource limit reached';
        break;
      case 'ENOSPC':
        suggestion = 'No space left on device';
        break;
      case 'EISDIR':
        suggestion = 'Expected file but found directory';
        break;
      case 'ENOTDIR':
        suggestion = 'Expected directory but found file';
        break;
      default:
        suggestion = 'Unknown file system error';
    }
    
    this.logError(error, {
      type: 'FileError',
      filePath,
      operation,
      suggestion
    });
    
    core.error(`${errorMessage}: ${error.message} (${suggestion})`);
  }

  /**
   * Handle network errors with specific guidance
   * @param {Error} error - Network error
   * @param {string} url - URL that failed
   * @param {string} context - Context of the request
   */
  handleNetworkError(error, url, context) {
    let errorMessage = `Network error during ${context}`;
    let suggestion = '';
    
    if (error.code) {
      switch (error.code) {
        case 'ENOTFOUND':
          suggestion = 'DNS resolution failed - check internet connection';
          break;
        case 'ECONNREFUSED':
          suggestion = 'Connection refused - server may be down';
          break;
        case 'ECONNRESET':
          suggestion = 'Connection reset - server closed the connection';
          break;
        case 'ETIMEDOUT':
          suggestion = 'Request timed out - server may be overloaded';
          break;
        case 'DEPTH_ZERO_SELF_SIGNED_CERT':
          suggestion = 'SSL certificate error - may need to configure certificate validation';
          break;
        default:
          suggestion = `Network error code: ${error.code}`;
      }
    } else if (error.response) {
      const status = error.response.status;
      if (status >= 400 && status < 500) {
        suggestion = `Client error (${status}) - check request parameters`;
      } else if (status >= 500) {
        suggestion = `Server error (${status}) - remote server issue`;
      }
    }
    
    this.logError(error, {
      type: 'NetworkError',
      url,
      context,
      suggestion
    });
    
    core.warning(`${errorMessage}: ${error.message} (${suggestion})`);
  }

  /**
   * Handle parser errors with recovery suggestions
   * @param {Error} error - Parser error
   * @param {string} filePath - File being parsed
   * @param {string} parser - Parser type
   */
  handleParserError(error, filePath, parser) {
    let errorMessage = `${parser} parsing failed for ${filePath}`;
    let suggestion = '';
    
    if (error.message.includes('Unexpected token')) {
      suggestion = 'Syntax error in file - check for malformed code';
    } else if (error.message.includes('Unexpected end')) {
      suggestion = 'Incomplete file - may be missing closing brackets or braces';
    } else if (error.message.includes('Invalid character')) {
      suggestion = 'File contains invalid characters - check encoding';
    } else {
      suggestion = 'File format may be invalid or unsupported';
    }
    
    this.logError(error, {
      type: 'ParserError',
      filePath,
      parser,
      suggestion
    });
    
    core.warning(`${errorMessage}: ${suggestion}`);
    
    // Provide graceful degradation
    if (this.options.gracefulDegradation) {
      core.info(`Skipping ${filePath} due to parsing errors`);
      return [];
    }
  }

  /**
   * Validate inputs and provide helpful error messages
   * @param {Object} inputs - Input parameters to validate
   * @param {Object} schema - Validation schema
   * @throws {Error} Validation error with helpful message
   */
  validateInputs(inputs, schema) {
    const errors = [];
    
    for (const [key, rules] of Object.entries(schema)) {
      const value = inputs[key];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${key} is required`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${key} must be of type ${rules.type}, got ${typeof value}`);
        }
        
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
        }
        
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${key} must be at least ${rules.min}`);
        }
        
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${key} must be at most ${rules.max}`);
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${key} format is invalid`);
        }
      }
    }
    
    if (errors.length > 0) {
      const error = new Error(`Input validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  /**
   * Create circuit breaker for failing operations
   * @param {Object} options - Circuit breaker options
   * @returns {Function} Circuit breaker function
   */
  createCircuitBreaker(options = {}) {
    const {
      failureThreshold = 5,
      recoveryTimeout = 30000,
      monitoringPeriod = 60000
    } = options;
    
    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let failures = 0;
    let lastFailureTime = 0;
    let lastResetTime = Date.now();
    
    return async (fn, context = 'operation') => {
      const now = Date.now();
      
      // Reset failure count after monitoring period
      if (now - lastResetTime > monitoringPeriod) {
        failures = 0;
        lastResetTime = now;
        if (state === 'OPEN') {
          state = 'HALF_OPEN';
        }
      }
      
      // Check circuit breaker state
      if (state === 'OPEN') {
        if (now - lastFailureTime > recoveryTimeout) {
          state = 'HALF_OPEN';
        } else {
          const error = new Error(`Circuit breaker is OPEN for ${context}`);
          error.code = 'CIRCUIT_BREAKER_OPEN';
          throw error;
        }
      }
      
      try {
        const result = await fn();
        
        // Success - reset circuit breaker
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
        }
        
        return result;
        
      } catch (error) {
        failures++;
        lastFailureTime = now;
        
        if (failures >= failureThreshold) {
          state = 'OPEN';
          core.warning(`Circuit breaker opened for ${context} after ${failures} failures`);
        }
        
        throw error;
      }
    };
  }

  /**
   * Log error with context and metadata
   * @param {Error} error - Error to log
   * @param {Object} metadata - Additional metadata
   */
  logError(error, metadata = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      code: error.code,
      type: error.constructor.name,
      ...metadata
    };
    
    this.errorLog.push(errorEntry);
    
    // Track error frequency
    const errorKey = `${errorEntry.type}:${error.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Log to file if enabled
    if (this.options.enableErrorReporting) {
      this.saveErrorLog();
    }
  }

  /**
   * Save error log to file
   */
  async saveErrorLog() {
    try {
      const logDir = path.dirname(this.options.errorLogPath);
      await fs.mkdir(logDir, { recursive: true });
      
      const logContent = this.errorLog
        .slice(-100) // Keep last 100 errors
        .map(entry => JSON.stringify(entry))
        .join('\n');
      
      await fs.writeFile(this.options.errorLogPath, logContent);
      
    } catch (error) {
      core.debug(`Failed to save error log: ${error.message}`);
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorLog.length,
      uniqueErrors: this.errorCounts.size,
      mostCommonErrors: Array.from(this.errorCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }))
    };
    
    // Group errors by type
    const errorsByType = {};
    this.errorLog.forEach(entry => {
      errorsByType[entry.type] = (errorsByType[entry.type] || 0) + 1;
    });
    stats.errorsByType = errorsByType;
    
    return stats;
  }

  /**
   * Perform graceful shutdown
   */
  async gracefulShutdown() {
    core.info('Performing graceful shutdown...');
    
    try {
      // Save error logs
      if (this.errorLog.length > 0) {
        await this.saveErrorLog();
      }
      
      // Log final statistics
      const stats = this.getErrorStats();
      if (stats.totalErrors > 0) {
        core.info(`Final error statistics: ${stats.totalErrors} total errors, ${stats.uniqueErrors} unique`);
      }
      
    } catch (error) {
      core.debug(`Error during graceful shutdown: ${error.message}`);
    } finally {
      process.exit(1);
    }
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create error with additional context
   * @param {string} message - Error message
   * @param {Object} context - Error context
   * @returns {Error} Enhanced error
   */
  static createError(message, context = {}) {
    const error = new Error(message);
    Object.assign(error, context);
    return error;
  }

  /**
   * Check if error is recoverable
   * @param {Error} error - Error to check
   * @returns {boolean} True if recoverable
   */
  static isRecoverable(error) {
    // Network errors are usually recoverable
    if (error.code && ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code)) {
      return true;
    }
    
    // HTTP 5xx errors are recoverable
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    // Rate limiting is recoverable
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    return false;
  }
}

module.exports = ErrorHandler;