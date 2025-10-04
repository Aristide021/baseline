const fs = require('fs').promises;
const path = require('path');
const core = require('@actions/core');

/**
 * Manages fetching and caching of Baseline data from the Web Platform Dashboard API
 */
class BaselineDataManager {
  constructor(options = {}) {
    this.apiBase = options.apiBase || 'https://api.webstatus.dev/v1/features';
    this.cache = new Map();
    this.cacheDir = options.cacheDir || '.baseline-cache';
    this.cacheDuration = options.cacheDuration || 24 * 60 * 60 * 1000; // 24 hours
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.fallbackData = null;
    this.useWebFeaturesAsFallback = options.useWebFeaturesAsFallback !== false; // Default: true
  }

  /**
   * Initialize the data manager and load fallback data
   */
  async initialize() {
    try {
      // Load fallback data if available
      const fallbackPath = path.join(__dirname, '..', 'data', 'fallback-baseline-data.json');
      try {
        const fallbackContent = await fs.readFile(fallbackPath, 'utf8');
        this.fallbackData = JSON.parse(fallbackContent);
        core.debug('Loaded fallback Baseline data');
      } catch (error) {
        core.debug('No fallback Baseline data available (using API)');
      }

      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      core.warning(`Failed to initialize BaselineDataManager: ${error.message}`);
    }
  }

  /**
   * Get all Baseline features with caching
   * @returns {Promise<Map<string, Object>>} Map of feature ID to feature data
   */
  async getAllBaselineFeatures() {
    const cacheKey = 'all-baseline-features';
    
    // Check memory cache first
    if (this.cache.has(cacheKey)) {
      core.debug('Using memory-cached Baseline data');
      return this.cache.get(cacheKey);
    }

    // Check disk cache
    const cachedData = await this.getCachedBaselineData();
    if (cachedData) {
      core.debug('Using disk-cached Baseline data');
      this.cache.set(cacheKey, cachedData);
      return cachedData;
    }

    // Try webstatus.dev API first, fallback to web-features
    try {
      core.info('Fetching fresh Baseline data from webstatus.dev API...');
      const allFeatures = await this.fetchAllFeaturesFromAPI();
      const featureMap = this.processAPIFeatureData(allFeatures);
      
      // Cache the results
      this.cache.set(cacheKey, featureMap);
      await this.setCachedBaselineData(featureMap);
      
      core.info(`Loaded ${featureMap.size} Baseline features from webstatus.dev API`);
      return featureMap;
    } catch (error) {
      core.warning(`webstatus.dev API failed: ${error.message}`);
      
      // Fallback to web-features database
      if (this.useWebFeaturesAsFallback) {
        try {
          core.info('Falling back to web-features database...');
          const webFeaturesData = await this.loadFromWebFeatures();
          const featureMap = this.processWebFeaturesData(webFeaturesData);
          
          // Cache the results
          this.cache.set(cacheKey, featureMap);
          await this.setCachedBaselineData(featureMap);
          
          core.info(`Loaded ${featureMap.size} Baseline features from web-features fallback`);
          return featureMap;
        } catch (webFeaturesError) {
          core.error(`Web-features fallback failed: ${webFeaturesError.message}`);
        }
      }
      
      // Final fallback to cached data
      if (this.fallbackData) {
        core.warning('Using fallback Baseline data due to all loading failures');
        const fallbackMap = this.processFeatureData(this.fallbackData);
        this.cache.set(cacheKey, fallbackMap);
        return fallbackMap;
      }
      
      throw new Error(`Unable to load Baseline data from any source: ${error.message}`);
    }
  }

  /**
   * Load features from web-features database
   * @returns {Promise<Object>} Features object from web-features
   */
  async loadFromWebFeatures() {
    try {
      // Check if we're in test environment
      if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
        const webFeatures = require('web-features');
        return webFeatures.features;
      }
      
      // Dynamic import for ESM compatibility in production
      const webFeatures = await import('web-features');
      return webFeatures.features;
    } catch (error) {
      throw new Error(`Failed to load web-features: ${error.message}`);
    }
  }

  /**
   * Process web-features data into our format
   * @param {Object} webFeaturesData - Raw web-features data
   * @returns {Map<string, Object>} Processed feature map
   */
  processWebFeaturesData(webFeaturesData) {
    const featureMap = new Map();
    
    Object.entries(webFeaturesData).forEach(([featureId, feature]) => {
      if (featureId && feature.name) {
        // Extract baseline information from web-features format
        const baseline = {
          status: this.mapWebFeaturesBaseline(feature.status?.baseline),
          low_date: feature.status?.baseline_low_date || null,
          high_date: feature.status?.baseline_high_date || null
        };
        
        featureMap.set(featureId, {
          id: featureId,
          name: feature.name,
          baseline: baseline,
          spec: feature.spec || [],
          compat: feature.compat_features || [],
          description: feature.description || '',
          description_html: feature.description_html || '',
          group: feature.group || '',
          mdn_url: '' // web-features doesn't include MDN URLs directly
        });
      }
    });
    
    return featureMap;
  }

  /**
   * Map web-features baseline status to our expected format
   * @param {string} webFeaturesBaseline - Baseline status from web-features
   * @returns {string} Our baseline status format
   */
  mapWebFeaturesBaseline(webFeaturesBaseline) {
    if (!webFeaturesBaseline) return 'unknown';
    
    // web-features uses: 'high', 'low', false
    // we expect: 'widely', 'newly', 'limited', 'unknown'
    switch (webFeaturesBaseline) {
    case 'high':
      return 'widely';
    case 'low': 
      return 'newly';
    case false:
      return 'limited';
    default:
      return 'unknown';
    }
  }

  /**
   * Process webstatus.dev API data into our format
   * @param {Array} apiData - Raw data from webstatus.dev API
   * @returns {Map<string, Object>} Processed feature map
   */
  processAPIFeatureData(apiData) {
    const featureMap = new Map();
    
    // webstatus.dev API returns array of feature objects
    apiData.forEach(feature => {
      // Use the feature name as ID if no explicit ID is provided
      const featureId = feature.feature_id || feature.id || this.generateIdFromName(feature.name);
      
      if (featureId && feature.name) {
        // Extract baseline information correctly from webstatus.dev API
        const baseline = feature.baseline ? {
          status: this.mapAPIBaselineStatus(feature.baseline.status),
          low_date: feature.baseline.low_date || null,
          high_date: feature.baseline.high_date || null
        } : {
          status: 'unknown',
          low_date: null,
          high_date: null
        };
        
        featureMap.set(featureId, {
          id: featureId,
          name: feature.name,
          baseline: baseline,
          spec: feature.spec || [],
          compat: feature.impl || {},
          description: feature.description || '',
          group: feature.group || '',
          mdn_url: '', // Not provided directly by API
          usage: feature.usage || {}
        });
      }
    });
    
    return featureMap;
  }

  /**
   * Generate a feature ID from the feature name
   * @param {string} name - Feature name
   * @returns {string} Generated ID
   */
  generateIdFromName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Map webstatus.dev API baseline status to our expected format
   * @param {string|Date|Object} apiBaseline - Baseline status from webstatus.dev API
   * @returns {string} Our baseline status format
   */
  mapAPIBaselineStatus(apiBaseline) {
    if (!apiBaseline) return 'unknown';
    
    // Handle different baseline formats from webstatus.dev API
    if (typeof apiBaseline === 'string') {
      switch (apiBaseline.toLowerCase()) {
      case 'widely':
      case 'high':
        return 'widely';
      case 'newly':
      case 'low':
        return 'newly';
      case 'limited':
      case 'false':
        return 'limited';
      default:
        return 'unknown';
      }
    }
    
    // Handle baseline as a date (if present, assume it's baseline)
    if (apiBaseline instanceof Date || typeof apiBaseline === 'object') {
      return 'newly'; // Default assumption for features with baseline dates
    }
    
    return 'unknown';
  }

  /**
   * Fetch all features from the webstatus.dev API
   * @returns {Promise<Array>} Array of all features
   */
  async fetchAllFeaturesFromAPI() {
    return await this.paginatedFetch('');
  }

  /**
   * Query features by baseline date range using webstatus.dev API
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of features that became baseline in the date range
   */
  async queryFeaturesByBaselineDate(startDate, endDate) {
    const query = `baseline_date:${startDate}..${endDate}`;
    return await this.paginatedFetch(query);
  }

  /**
   * Query features by baseline year using webstatus.dev API
   * @param {number} year - Baseline year
   * @returns {Promise<Array>} Array of features from that baseline year
   */
  async queryFeaturesByBaselineYear(year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    return await this.queryFeaturesByBaselineDate(startDate, endDate);
  }

  /**
   * Fetch data with pagination support from webstatus.dev API
   * @param {string} query - Search query
   * @param {string|null} pageToken - Page token for pagination
   * @returns {Promise<Array>} Array of features
   */
  async paginatedFetch(query, pageToken = null) {
    let url = `${this.apiBase}`;
    const params = new URLSearchParams();
    
    if (query) {
      params.append('q', query);
    }
    
    if (pageToken) {
      params.append('page_token', pageToken);
    }
    
    url += `?${params.toString()}`;

    const response = await this.fetchWithRetry(url);
    const responseData = await response.json();
    
    // webstatus.dev API returns data directly as an array, not wrapped in {data, metadata}
    let allData;
    if (Array.isArray(responseData)) {
      allData = responseData;
    } else if (responseData.data) {
      allData = responseData.data;
    } else {
      throw new Error('Unexpected API response format');
    }
    
    // For now, we'll assume no pagination since the API structure isn't fully documented
    // TODO: Add pagination support when API documentation is available
    
    return allData;
  }

  /**
   * Fetch with retry logic and error handling
   * @param {string} url - URL to fetch
   * @returns {Promise<Response>} Fetch response
   */
  async fetchWithRetry(url) {
    let lastError;
    
    // Dynamic import of node-fetch for ESM compatibility
    const fetch = (await import('node-fetch')).default;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        core.debug(`Fetching ${url} (attempt ${attempt}/${this.maxRetries})`);
        
        const response = await fetch(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'baseline-github-action/1.0',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error;
        core.warning(`API attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          core.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Process raw feature data into a structured map
   * @param {Array} features - Raw feature data from API
   * @returns {Map<string, Object>} Processed feature map
   */
  processFeatureData(features) {
    const featureMap = new Map();
    
    features.forEach(feature => {
      if (feature.feature_id && feature.name) {
        featureMap.set(feature.feature_id, {
          id: feature.feature_id,
          name: feature.name,
          baseline: feature.baseline || { status: 'unknown' },
          spec: feature.spec || {},
          compat: feature.compat || {},
          usage: feature.usage || {},
          description: feature.description || '',
          mdn_url: feature.mdn_url || ''
        });
      }
    });
    
    return featureMap;
  }

  /**
   * Get Baseline status for a specific feature
   * @param {string} featureId - Feature ID
   * @returns {string} Baseline status (limited|newly|widely|unknown)
   */
  getBaselineStatus(featureId) {
    const features = this.cache.get('all-baseline-features');
    const feature = features?.get(featureId);
    return feature?.baseline?.status || 'unknown';
  }

  /**
   * Get detailed feature information
   * @param {string} featureId - Feature ID
   * @returns {Object|null} Feature information or null if not found
   */
  getFeatureInfo(featureId) {
    const features = this.cache.get('all-baseline-features');
    return features?.get(featureId) || null;
  }

  /**
   * Check if cached data is valid
   * @returns {Promise<boolean>} True if cached data is valid
   */
  async isCacheValid() {
    try {
      const cacheFile = path.join(this.cacheDir, 'baseline-data.json');
      const metaFile = path.join(this.cacheDir, 'cache-meta.json');
      
      const [dataStats, metaContent] = await Promise.all([
        fs.stat(cacheFile),
        fs.readFile(metaFile, 'utf8').catch(() => '{}')
      ]);
      
      const meta = JSON.parse(metaContent);
      const cacheAge = Date.now() - dataStats.mtime.getTime();
      
      return cacheAge < this.cacheDuration && meta.version === '1.0';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached Baseline data from disk
   * @returns {Promise<Map<string, Object>|null>} Cached data or null
   */
  async getCachedBaselineData() {
    try {
      if (!(await this.isCacheValid())) {
        return null;
      }
      
      const cacheFile = path.join(this.cacheDir, 'baseline-data.json');
      const content = await fs.readFile(cacheFile, 'utf8');
      const data = JSON.parse(content);
      
      // Convert back to Map
      const featureMap = new Map();
      Object.entries(data.features).forEach(([key, value]) => {
        featureMap.set(key, value);
      });
      
      return featureMap;
    } catch (error) {
      core.debug(`Failed to read cache: ${error.message}`);
      return null;
    }
  }

  /**
   * Save Baseline data to disk cache
   * @param {Map<string, Object>} data - Data to cache
   */
  async setCachedBaselineData(data) {
    try {
      const cacheFile = path.join(this.cacheDir, 'baseline-data.json');
      const metaFile = path.join(this.cacheDir, 'cache-meta.json');
      
      // Convert Map to Object for JSON serialization
      const serializable = {
        features: Object.fromEntries(data),
        timestamp: new Date().toISOString()
      };
      
      const meta = {
        version: '1.0',
        created: new Date().toISOString(),
        featureCount: data.size
      };
      
      await Promise.all([
        fs.writeFile(cacheFile, JSON.stringify(serializable, null, 2)),
        fs.writeFile(metaFile, JSON.stringify(meta, null, 2))
      ]);
      
      core.debug(`Cached ${data.size} features to disk`);
    } catch (error) {
      core.warning(`Failed to cache data: ${error.message}`);
    }
  }

  /**
   * Search for features by name or description
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching features
   */
  async searchFeatures(query) {
    const features = await this.getAllBaselineFeatures();
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [id, feature] of features) {
      if (feature.name.toLowerCase().includes(lowerQuery) || 
          feature.description.toLowerCase().includes(lowerQuery)) {
        results.push({ id, ...feature });
      }
    }
    
    return results;
  }

  /**
   * Get features by Baseline status
   * @param {string} status - Baseline status (limited|newly|widely)
   * @returns {Promise<Array>} Array of features with the given status
   */
  async getFeaturesByStatus(status) {
    const features = await this.getAllBaselineFeatures();
    const results = [];
    
    for (const [id, feature] of features) {
      if (feature.baseline?.status === status) {
        results.push({ id, ...feature });
      }
    }
    
    return results;
  }

  /**
   * Get features by baseline year (when they became baseline)
   * @param {number} year - Year when features became baseline
   * @returns {Promise<Array>} Array of features that became baseline in that year
   */
  async getFeaturesByYear(year) {
    const features = await this.getAllBaselineFeatures();
    const results = [];
    
    for (const [id, feature] of features) {
      if (feature.baseline?.low_date) {
        const baselineYear = new Date(feature.baseline.low_date).getFullYear();
        if (baselineYear === year) {
          results.push({ id, ...feature });
        }
      }
    }
    
    return results;
  }

  /**
   * Get features by baseline date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of features that became baseline in the date range
   */
  async getFeaturesByDateRange(startDate, endDate) {
    const features = await this.getAllBaselineFeatures();
    const results = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (const [id, feature] of features) {
      if (feature.baseline?.low_date) {
        const baselineDate = new Date(feature.baseline.low_date);
        if (baselineDate >= start && baselineDate <= end) {
          results.push({ id, ...feature });
        }
      }
    }
    
    return results;
  }

  /**
   * Get yearly baseline summary with feature counts and enforcement levels
   * @returns {Promise<Object>} Yearly breakdown with enforcement recommendations
   */
  async getYearlyBaselineSummary() {
    const features = await this.getAllBaselineFeatures();
    const yearlyBreakdown = {};
    const currentYear = new Date().getFullYear();
    
    for (const [id, feature] of features) {
      if (feature.baseline?.low_date) {
        const year = new Date(feature.baseline.low_date).getFullYear();
        if (!yearlyBreakdown[year]) {
          yearlyBreakdown[year] = {
            year: year,
            features: [],
            count: 0,
            status_breakdown: { limited: 0, newly: 0, widely: 0 },
            age: currentYear - year,
            recommended_enforcement: this.getRecommendedEnforcement(currentYear - year)
          };
        }
        
        yearlyBreakdown[year].features.push({ id, name: feature.name, status: feature.baseline.status });
        yearlyBreakdown[year].count++;
        yearlyBreakdown[year].status_breakdown[feature.baseline.status]++;
      }
    }
    
    return yearlyBreakdown;
  }

  /**
   * Get recommended enforcement level based on feature age
   * @private
   * @param {number} ageInYears - Age of the feature in years
   * @returns {string} Recommended enforcement level
   */
  getRecommendedEnforcement(ageInYears) {
    if (ageInYears >= 3) return 'error';      // 3+ years: enforce strictly
    if (ageInYears >= 2) return 'warn';       // 2+ years: warn but allow
    if (ageInYears >= 1) return 'info';       // 1+ years: informational
    return 'off';                             // <1 year: skip enforcement
  }

  /**
   * Check if we have our own feature mappings for yearly enforcement
   * Integrates with our curated feature mappings
   * @param {Array} mappedFeatureIds - Array of feature IDs we have mappings for
   * @returns {Promise<Object>} Yearly coverage analysis
   */
  async analyzeYearlyCoverage(mappedFeatureIds) {
    const yearlyBreakdown = await this.getYearlyBaselineSummary();
    const mappedSet = new Set(mappedFeatureIds);
    
    Object.keys(yearlyBreakdown).forEach(year => {
      const yearData = yearlyBreakdown[year];
      yearData.mapped_features = yearData.features.filter(f => mappedSet.has(f.id));
      yearData.mapped_count = yearData.mapped_features.length;
      yearData.coverage_percentage = Math.round((yearData.mapped_count / yearData.count) * 100);
      yearData.enforceable = yearData.mapped_count > 0;
    });
    
    return yearlyBreakdown;
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    this.cache.clear();
    
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      core.info('Cache cleared successfully');
    } catch (error) {
      core.warning(`Failed to clear cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const memoryCache = this.cache.get('all-baseline-features');
    return {
      memoryCacheSize: memoryCache ? memoryCache.size : 0,
      hasFallbackData: !!this.fallbackData,
      cacheDirectory: this.cacheDir
    };
  }
}

module.exports = BaselineDataManager;