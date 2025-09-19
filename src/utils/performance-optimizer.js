const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const core = require('@actions/core');

/**
 * Performance optimization utilities for the Baseline GitHub Action
 */
class PerformanceOptimizer {
  constructor(options = {}) {
    this.options = {
      enableFileHashing: options.enableFileHashing !== false,
      enableParallelProcessing: options.enableParallelProcessing !== false,
      maxConcurrentFiles: options.maxConcurrentFiles || 10,
      cacheDirectory: options.cacheDirectory || '.baseline-cache',
      enableProgressiveAnalysis: options.enableProgressiveAnalysis !== false,
      memoryThreshold: options.memoryThreshold || 100 * 1024 * 1024, // 100MB
      ...options
    };
    
    this.fileCache = new Map();
    this.hashCache = new Map();
    this.analysisCache = new Map();
    this.stats = {
      filesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0,
      parallelSavings: 0
    };
  }

  /**
   * Process files with performance optimizations
   * @param {Array} filePaths - Array of file paths to process
   * @param {Function} processingFunction - Function to process each file
   * @returns {Promise<Array>} Array of processing results
   */
  async processFiles(filePaths, processingFunction) {
    const startTime = Date.now();
    
    core.debug(`Processing ${filePaths.length} files with performance optimizations`);
    
    // Filter files that need processing (check cache)
    const filesToProcess = await this.getFilesToProcess(filePaths);
    
    core.debug(`${filesToProcess.length} files need processing (${filePaths.length - filesToProcess.length} cached)`);
    
    // Process files in batches for optimal performance
    const results = await this.processBatches(filesToProcess, processingFunction);
    
    // Merge with cached results
    const allResults = await this.mergeWithCachedResults(filePaths, results);
    
    const totalTime = Date.now() - startTime;
    this.stats.totalProcessingTime += totalTime;
    
    core.debug(`File processing completed in ${totalTime}ms`);
    this.logPerformanceStats();
    
    return allResults;
  }

  /**
   * Get files that need processing (not cached or modified)
   * @param {Array} filePaths - Array of file paths
   * @returns {Promise<Array>} Array of files that need processing
   */
  async getFilesToProcess(filePaths) {
    if (!this.options.enableFileHashing) {
      return filePaths; // Process all files if hashing disabled
    }

    const filesToProcess = [];
    
    for (const filePath of filePaths) {
      const needsProcessing = await this.fileNeedsProcessing(filePath);
      if (needsProcessing) {
        filesToProcess.push(filePath);
      } else {
        this.stats.cacheHits++;
      }
    }
    
    return filesToProcess;
  }

  /**
   * Check if a file needs processing based on cache and modification time
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file needs processing
   */
  async fileNeedsProcessing(filePath) {
    try {
      const currentHash = await this.getFileHash(filePath);
      const cachedHash = this.hashCache.get(filePath);
      
      if (cachedHash === currentHash && this.analysisCache.has(filePath)) {
        return false; // File hasn't changed and we have cached results
      }
      
      this.hashCache.set(filePath, currentHash);
      return true;
      
    } catch (error) {
      core.debug(`Error checking file ${filePath}: ${error.message}`);
      return true; // Process if we can't determine
    }
  }

  /**
   * Get file hash for change detection
   * @param {string} filePath - File path
   * @returns {Promise<string>} File hash
   */
  async getFileHash(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath);
      
      // Create hash from file size, modification time, and content
      const hash = crypto.createHash('md5');
      hash.update(stats.size.toString());
      hash.update(stats.mtime.toISOString());
      hash.update(content);
      
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to hash file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Process files in optimized batches
   * @param {Array} filePaths - Files to process
   * @param {Function} processingFunction - Processing function
   * @returns {Promise<Map>} Map of file path to results
   */
  async processBatches(filePaths, processingFunction) {
    if (!this.options.enableParallelProcessing || filePaths.length <= 1) {
      return await this.processSequentially(filePaths, processingFunction);
    }

    const batchSize = Math.min(this.options.maxConcurrentFiles, filePaths.length);
    const results = new Map();
    
    // Process files in parallel batches
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchStartTime = Date.now();
      
      const batchPromises = batch.map(async (filePath) => {
        try {
          const result = await processingFunction(filePath);
          this.analysisCache.set(filePath, result); // Cache the result
          return { filePath, result, success: true };
        } catch (error) {
          core.warning(`Failed to process ${filePath}: ${error.message}`);
          return { filePath, result: [], success: false, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Calculate parallel processing savings
      const batchTime = Date.now() - batchStartTime;
      const sequentialEstimate = batchTime * batch.length;
      this.stats.parallelSavings += sequentialEstimate - batchTime;
      
      // Store results
      for (const { filePath, result, success } of batchResults) {
        if (success) {
          results.set(filePath, result);
          this.stats.filesProcessed++;
        }
      }

      // Memory management - clear cache if getting too large
      await this.manageMemory();
    }
    
    return results;
  }

  /**
   * Process files sequentially (fallback)
   * @param {Array} filePaths - Files to process
   * @param {Function} processingFunction - Processing function
   * @returns {Promise<Map>} Map of file path to results
   */
  async processSequentially(filePaths, processingFunction) {
    const results = new Map();
    
    for (const filePath of filePaths) {
      try {
        const result = await processingFunction(filePath);
        results.set(filePath, result);
        this.analysisCache.set(filePath, result);
        this.stats.filesProcessed++;
      } catch (error) {
        core.warning(`Failed to process ${filePath}: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * Merge processing results with cached results
   * @param {Array} allFilePaths - All file paths requested
   * @param {Map} processedResults - Results from processing
   * @returns {Promise<Array>} Complete results array
   */
  async mergeWithCachedResults(allFilePaths, processedResults) {
    const allResults = [];
    
    for (const filePath of allFilePaths) {
      if (processedResults.has(filePath)) {
        // Use freshly processed results
        allResults.push(...processedResults.get(filePath));
      } else if (this.analysisCache.has(filePath)) {
        // Use cached results
        allResults.push(...this.analysisCache.get(filePath));
      } else {
        // No results available (error case)
        core.debug(`No results available for ${filePath}`);
      }
    }
    
    return allResults;
  }

  /**
   * Manage memory usage by clearing old cache entries
   * @returns {Promise<void>}
   */
  async manageMemory() {
    const memoryUsage = process.memoryUsage();
    
    if (memoryUsage.heapUsed > this.options.memoryThreshold) {
      core.debug('Memory threshold reached, clearing old cache entries');
      
      // Clear oldest cache entries (simple LRU-like behavior)
      const cacheSize = this.analysisCache.size;
      if (cacheSize > 100) {
        const entries = Array.from(this.analysisCache.entries());
        const toDelete = entries.slice(0, Math.floor(cacheSize * 0.3));
        
        for (const [key] of toDelete) {
          this.analysisCache.delete(key);
          this.hashCache.delete(key);
        }
        
        core.debug(`Cleared ${toDelete.length} cache entries`);
      }
    }
  }

  /**
   * Create optimized file reader with caching
   * @param {string} filePath - File path to read
   * @returns {Promise<string>} File content
   */
  async readFileOptimized(filePath) {
    const cacheKey = `file:${filePath}`;
    
    // Check memory cache first
    if (this.fileCache.has(cacheKey)) {
      const { content, hash } = this.fileCache.get(cacheKey);
      const currentHash = await this.getFileHash(filePath);
      
      if (hash === currentHash) {
        return content;
      }
    }

    // Read file and cache
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const hash = await this.getFileHash(filePath);
      
      this.fileCache.set(cacheKey, { content, hash });
      return content;
      
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Save analysis cache to disk for persistence across runs
   * @returns {Promise<void>}
   */
  async saveCacheToDisk() {
    try {
      const cacheDir = this.options.cacheDirectory;
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheData = {
        analysisCache: Object.fromEntries(this.analysisCache),
        hashCache: Object.fromEntries(this.hashCache),
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      const cacheFile = path.join(cacheDir, 'analysis-cache.json');
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
      
      core.debug(`Analysis cache saved to ${cacheFile}`);
      
    } catch (error) {
      core.warning(`Failed to save analysis cache: ${error.message}`);
    }
  }

  /**
   * Load analysis cache from disk
   * @returns {Promise<void>}
   */
  async loadCacheFromDisk() {
    try {
      const cacheFile = path.join(this.options.cacheDirectory, 'analysis-cache.json');
      const cacheContent = await fs.readFile(cacheFile, 'utf8');
      const cacheData = JSON.parse(cacheContent);
      
      // Check cache version and age
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheData.version === '1.0' && cacheAge < maxAge) {
        this.analysisCache = new Map(Object.entries(cacheData.analysisCache || {}));
        this.hashCache = new Map(Object.entries(cacheData.hashCache || {}));
        
        core.debug(`Loaded analysis cache with ${this.analysisCache.size} entries`);
      } else {
        core.debug('Analysis cache expired or incompatible, starting fresh');
      }
      
    } catch (error) {
      core.debug(`No existing analysis cache found: ${error.message}`);
    }
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.fileCache.clear();
    this.hashCache.clear();
    this.analysisCache.clear();
    core.debug('All caches cleared');
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    const stats = { ...this.stats };
    
    // Calculate additional metrics
    stats.cacheHitRate = stats.cacheHits / (stats.cacheHits + stats.cacheMisses) * 100;
    stats.avgProcessingTime = stats.filesProcessed > 0 ? 
      stats.totalProcessingTime / stats.filesProcessed : 0;
    
    return stats;
  }

  /**
   * Log performance statistics
   */
  logPerformanceStats() {
    const stats = this.getPerformanceStats();
    
    core.debug('Performance Statistics:');
    core.debug(`  Files Processed: ${stats.filesProcessed}`);
    core.debug(`  Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%`);
    core.debug(`  Total Processing Time: ${stats.totalProcessingTime}ms`);
    core.debug(`  Parallel Savings: ${stats.parallelSavings}ms`);
    
    if (stats.avgProcessingTime > 0) {
      core.debug(`  Average Processing Time: ${stats.avgProcessingTime.toFixed(1)}ms per file`);
    }
  }

  /**
   * Create a debounced function to reduce frequent operations
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  static debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Create a throttled function to limit execution frequency
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Optimize file pattern matching for large file sets
   * @param {Array} patterns - Glob patterns
   * @param {Array} filePaths - File paths to match
   * @returns {Array} Matching file paths
   */
  static optimizePatternMatching(patterns, filePaths) {
    const micromatch = require('micromatch');
    
    // Pre-compile patterns for better performance
    const compiledPatterns = patterns.map(pattern => ({
      pattern,
      regex: micromatch.makeRe(pattern)
    }));
    
    return filePaths.filter(filePath => {
      return compiledPatterns.some(({ regex }) => regex && regex.test(filePath));
    });
  }

  /**
   * Batch operations for better performance
   * @param {Array} items - Items to process
   * @param {Function} operation - Operation to perform
   * @param {number} batchSize - Size of each batch
   * @returns {Promise<Array>} Results
   */
  static async batchOperation(items, operation, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => operation(item))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}

module.exports = PerformanceOptimizer;