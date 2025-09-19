const fs = require('fs').promises;
const path = require('path');
const core = require('@actions/core');

/**
 * Loads and validates Baseline configuration from various sources
 */
class ConfigLoader {
  constructor(options = {}) {
    this.options = {
      configFileName: options.configFileName || '.baseline.json',
      workingDirectory: options.workingDirectory || process.cwd(),
      allowJSConfig: options.allowJSConfig !== false,
      ...options
    };
    
    this.defaultConfig = {
      rules: {
        css: {
          'baseline-threshold': 'newly',
          'strict-mode': false,
          'allowed-exceptions': [],
          'ignore-vendor-prefixes': true,
          'experimental-features': false
        },
        javascript: {
          'baseline-threshold': 'newly',
          'strict-mode': true,
          'allowed-exceptions': [],
          'polyfill-detection': true,
          'modern-syntax-only': false
        },
        html: {
          'baseline-threshold': 'newly',
          'ignore-attributes': ['data-*'],
          'allowed-exceptions': [],
          'validate-semantics': true
        }
      },
      enforcement: {
        'max-violations': 0,
        'fail-on-new-only': false,
        'severity-weights': {
          'high': 1.0,
          'medium': 0.6,
          'low': 0.3
        },
        'ignore-patterns': ['node_modules/**', 'dist/**', 'build/**'],
        'include-patterns': ['**/*.{js,jsx,ts,tsx,css,scss,sass,less,html,htm}']
      },
      reporting: {
        'include-remediation': true,
        'group-by-feature': true,
        'show-polyfill-suggestions': true,
        'include-compatibility-data': true,
        'max-violations-per-file': 50,
        'output-format': 'markdown'
      },
      github: {
        'comment-on-pr': true,
        'update-existing-comment': true,
        'create-status-check': true,
        'status-check-name': 'Baseline Compliance'
      }
    };
  }

  /**
   * Load configuration from all available sources
   * @returns {Promise<Object>} Merged configuration
   */
  async loadConfig() {
    const configs = [];

    // 1. Load default configuration
    configs.push(this.defaultConfig);

    // 2. Load configuration file
    const fileConfig = await this.loadConfigFile();
    if (fileConfig) {
      configs.push(fileConfig);
    }

    // 3. Load package.json configuration
    const packageConfig = await this.loadPackageJSONConfig();
    if (packageConfig) {
      configs.push(packageConfig);
    }

    // 4. Load GitHub Action inputs
    const actionConfig = this.loadActionInputs();
    if (actionConfig) {
      configs.push(actionConfig);
    }

    // 5. Load environment variables
    const envConfig = this.loadEnvironmentConfig();
    if (envConfig) {
      configs.push(envConfig);
    }

    // Merge all configurations (later configs override earlier ones)
    const mergedConfig = this.mergeConfigs(configs);

    // Validate the final configuration
    this.validateConfig(mergedConfig);

    core.info('Configuration loaded successfully');
    core.debug(`Final configuration: ${JSON.stringify(mergedConfig, null, 2)}`);

    return mergedConfig;
  }

  /**
   * Load configuration from .baseline.json or baseline.config.js
   * @returns {Promise<Object|null>} Configuration object or null
   */
  async loadConfigFile() {
    const possiblePaths = [
      path.join(this.options.workingDirectory, this.options.configFileName),
      path.join(this.options.workingDirectory, '.baseline.json'),
      path.join(this.options.workingDirectory, 'baseline.config.json')
    ];

    // Also try JavaScript config if allowed
    if (this.options.allowJSConfig) {
      possiblePaths.push(
        path.join(this.options.workingDirectory, 'baseline.config.js'),
        path.join(this.options.workingDirectory, '.baselinerc.js')
      );
    }

    for (const configPath of possiblePaths) {
      try {
        if (await this.fileExists(configPath)) {
          core.info(`Loading configuration from ${configPath}`);
          
          if (configPath.endsWith('.js')) {
            return await this.loadJSConfig(configPath);
          } else {
            return await this.loadJSONConfig(configPath);
          }
        }
      } catch (error) {
        core.warning(`Failed to load config from ${configPath}: ${error.message}`);
      }
    }

    core.debug('No configuration file found, using defaults');
    return null;
  }

  /**
   * Load JSON configuration file
   * @param {string} configPath - Path to config file
   * @returns {Promise<Object>} Configuration object
   */
  async loadJSONConfig(configPath) {
    const content = await fs.readFile(configPath, 'utf8');
    
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in ${configPath}: ${error.message}`);
    }
  }

  /**
   * Load JavaScript configuration file
   * @param {string} configPath - Path to config file
   * @returns {Promise<Object>} Configuration object
   */
  async loadJSConfig(configPath) {
    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(configPath)];
      
      const config = require(configPath);
      
      // Support both module.exports and ES6 default export
      return typeof config === 'function' ? config() : config;
    } catch (error) {
      throw new Error(`Failed to load JavaScript config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Load configuration from package.json
   * @returns {Promise<Object|null>} Configuration object or null
   */
  async loadPackageJSONConfig() {
    const packagePath = path.join(this.options.workingDirectory, 'package.json');
    
    try {
      if (await this.fileExists(packagePath)) {
        const content = await fs.readFile(packagePath, 'utf8');
        const packageJSON = JSON.parse(content);
        
        if (packageJSON.baseline) {
          core.info('Loading configuration from package.json');
          return packageJSON.baseline;
        }
      }
    } catch (error) {
      core.warning(`Failed to load package.json config: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Load configuration from GitHub Action inputs
   * @returns {Object|null} Configuration object or null
   */
  loadActionInputs() {
    const inputs = {};
    let hasInputs = false;

    // Map GitHub Action inputs to configuration structure
    const inputMappings = [
      { input: 'baseline-threshold', path: 'rules.css.baseline-threshold' },
      { input: 'include-patterns', path: 'enforcement.include-patterns' },
      { input: 'exclude-patterns', path: 'enforcement.ignore-patterns' },
      { input: 'max-violations', path: 'enforcement.max-violations', type: 'number' },
      { input: 'comment-on-pr', path: 'github.comment-on-pr', type: 'boolean' },
      { input: 'fail-on-new-only', path: 'enforcement.fail-on-new-only', type: 'boolean' }
    ];

    for (const mapping of inputMappings) {
      const value = core.getInput(mapping.input);
      
      if (value && value.trim()) {
        hasInputs = true;
        let processedValue = value.trim();
        
        // Type conversion
        if (mapping.type === 'number') {
          processedValue = parseInt(processedValue, 10);
        } else if (mapping.type === 'boolean') {
          processedValue = processedValue.toLowerCase() === 'true';
        }
        
        // Set nested property
        this.setNestedProperty(inputs, mapping.path, processedValue);
      }
    }

    if (hasInputs) {
      core.info('Loading configuration from GitHub Action inputs');
      return inputs;
    }

    return null;
  }

  /**
   * Load configuration from environment variables
   * @returns {Object|null} Configuration object or null
   */
  loadEnvironmentConfig() {
    const envConfig = {};
    let hasEnvConfig = false;

    // Map environment variables to configuration
    const envMappings = [
      { env: 'BASELINE_THRESHOLD', path: 'rules.css.baseline-threshold' },
      { env: 'BASELINE_MAX_VIOLATIONS', path: 'enforcement.max-violations', type: 'number' },
      { env: 'BASELINE_STRICT_MODE', path: 'rules.javascript.strict-mode', type: 'boolean' },
      { env: 'BASELINE_COMMENT_ON_PR', path: 'github.comment-on-pr', type: 'boolean' }
    ];

    for (const mapping of envMappings) {
      const value = process.env[mapping.env];
      
      if (value) {
        hasEnvConfig = true;
        let processedValue = value;
        
        // Type conversion
        if (mapping.type === 'number') {
          processedValue = parseInt(processedValue, 10);
        } else if (mapping.type === 'boolean') {
          processedValue = processedValue.toLowerCase() === 'true';
        }
        
        this.setNestedProperty(envConfig, mapping.path, processedValue);
      }
    }

    if (hasEnvConfig) {
      core.info('Loading configuration from environment variables');
      return envConfig;
    }

    return null;
  }

  /**
   * Merge multiple configuration objects
   * @param {Array} configs - Array of configuration objects
   * @returns {Object} Merged configuration
   */
  mergeConfigs(configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {});
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  validateConfig(config) {
    const errors = [];

    // Validate baseline thresholds
    const validThresholds = ['limited', 'newly', 'widely'];
    
    if (config.rules?.css?.['baseline-threshold'] && 
        !validThresholds.includes(config.rules.css['baseline-threshold'])) {
      errors.push(`Invalid CSS baseline threshold: ${config.rules.css['baseline-threshold']}`);
    }

    if (config.rules?.javascript?.['baseline-threshold'] && 
        !validThresholds.includes(config.rules.javascript['baseline-threshold'])) {
      errors.push(`Invalid JavaScript baseline threshold: ${config.rules.javascript['baseline-threshold']}`);
    }

    if (config.rules?.html?.['baseline-threshold'] && 
        !validThresholds.includes(config.rules.html['baseline-threshold'])) {
      errors.push(`Invalid HTML baseline threshold: ${config.rules.html['baseline-threshold']}`);
    }

    // Validate max violations
    if (config.enforcement?.['max-violations'] !== undefined && 
        (typeof config.enforcement['max-violations'] !== 'number' || 
         config.enforcement['max-violations'] < 0)) {
      errors.push('max-violations must be a non-negative number');
    }

    // Validate severity weights
    if (config.enforcement?.['severity-weights']) {
      const weights = config.enforcement['severity-weights'];
      for (const [severity, weight] of Object.entries(weights)) {
        if (typeof weight !== 'number' || weight < 0 || weight > 1) {
          errors.push(`Severity weight for ${severity} must be a number between 0 and 1`);
        }
      }
    }

    // Validate output format
    const validFormats = ['markdown', 'json', 'html'];
    if (config.reporting?.['output-format'] && 
        !validFormats.includes(config.reporting['output-format'])) {
      errors.push(`Invalid output format: ${config.reporting['output-format']}`);
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    core.debug('Configuration validation passed');
  }

  /**
   * Generate example configuration file
   * @returns {string} Example configuration as JSON string
   */
  generateExampleConfig() {
    const example = {
      '$schema': 'https://baseline.dev/schemas/config.json',
      rules: {
        css: {
          'baseline-threshold': 'newly',
          'allowed-exceptions': [
            {
              feature: 'css-container-queries',
              reason: 'Progressive enhancement with fallback',
              files: ['src/components/modern/**']
            }
          ]
        },
        javascript: {
          'baseline-threshold': 'newly',
          'strict-mode': true
        },
        html: {
          'baseline-threshold': 'newly',
          'ignore-attributes': ['data-*']
        }
      },
      enforcement: {
        'max-violations': 0,
        'fail-on-new-only': false
      },
      reporting: {
        'include-remediation': true,
        'group-by-feature': true,
        'show-polyfill-suggestions': true
      }
    };

    return JSON.stringify(example, null, 2);
  }

  /**
   * Save configuration to file
   * @param {Object} config - Configuration object
   * @param {string} filePath - Output file path
   * @returns {Promise<void>}
   */
  async saveConfig(config, filePath) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
      core.info(`Configuration saved to ${filePath}`);
    } catch (error) {
      core.error(`Failed to save configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get configuration schema for validation
   * @returns {Object} JSON Schema object
   */
  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        rules: {
          type: 'object',
          properties: {
            css: {
              type: 'object',
              properties: {
                'baseline-threshold': { enum: ['limited', 'newly', 'widely'] },
                'strict-mode': { type: 'boolean' },
                'allowed-exceptions': { type: 'array' }
              }
            },
            javascript: {
              type: 'object',
              properties: {
                'baseline-threshold': { enum: ['limited', 'newly', 'widely'] },
                'strict-mode': { type: 'boolean' },
                'allowed-exceptions': { type: 'array' }
              }
            },
            html: {
              type: 'object',
              properties: {
                'baseline-threshold': { enum: ['limited', 'newly', 'widely'] },
                'ignore-attributes': { type: 'array' },
                'allowed-exceptions': { type: 'array' }
              }
            }
          }
        },
        enforcement: {
          type: 'object',
          properties: {
            'max-violations': { type: 'number', minimum: 0 },
            'fail-on-new-only': { type: 'boolean' }
          }
        },
        reporting: {
          type: 'object',
          properties: {
            'include-remediation': { type: 'boolean' },
            'group-by-feature': { type: 'boolean' },
            'output-format': { enum: ['markdown', 'json', 'html'] }
          }
        }
      }
    };
  }

  // Helper methods

  /**
   * Check if file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set nested property on object
   * @param {Object} obj - Target object
   * @param {string} path - Property path (dot notation)
   * @param {*} value - Value to set
   */
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get nested property from object
   * @param {Object} obj - Source object
   * @param {string} path - Property path (dot notation)
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Property value or default
   */
  getNestedProperty(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }

    return current !== undefined ? current : defaultValue;
  }
}

module.exports = ConfigLoader;