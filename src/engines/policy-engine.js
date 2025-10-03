const core = require('@actions/core');

/**
 * Policy Engine for evaluating features against Baseline compliance rules
 */
class PolicyEngine {
  constructor(config = {}, baselineDataManager) {
    this.config = config;
    this.baselineDataManager = baselineDataManager;
    this.violations = [];
    
    // Auto-configure enforcement based on official Baseline queries
    this.autoConfigureFromBaselineQueries();
    
    // Default configuration
    this.defaultConfig = {
      rules: {
        css: {
          'baseline-threshold': 'newly',
          'strict-mode': false,
          'allowed-exceptions': []
        },
        javascript: {
          'baseline-threshold': 'newly',
          'strict-mode': true,
          'allowed-exceptions': []
        },
        html: {
          'baseline-threshold': 'newly',
          'ignore-attributes': ['data-*'],
          'allowed-exceptions': []
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
        'mode': 'per-feature',  // 'per-feature' | 'yearly' | 'hybrid'
        'yearly-rules': {
          2022: 'error',  // 3+ years: enforce strictly
          2023: 'warn',   // 2+ years: warn but allow  
          2024: 'info',   // 1+ years: informational
          2025: 'off'     // <1 year: skip enforcement
        },
        'interop-priority': false  // Boost enforcement for top interop features
      },
      reporting: {
        'include-remediation': true,
        'group-by-feature': true,
        'show-polyfill-suggestions': true,
        'include-compatibility-data': true
      }
    };

    // Merge default config with provided config
    this.mergedConfig = this.mergeConfigs(this.defaultConfig, config);
  }

  /**
   * Auto-configure enforcement based on official Baseline queries detected in browserslist
   */
  autoConfigureFromBaselineQueries() {
    if (!this.config.baselineQueries?.hasBaselineQueries) {
      return; // No official Baseline queries detected
    }

    const baselineInfo = this.config.baselineQueries;
    core.info('Auto-configuring enforcement based on official Baseline queries');

    // Create enhanced enforcement configuration
    const enhancedEnforcement = {
      'baseline-query-mode': true,
      'detected-queries': baselineInfo.queries
    };

    // Configure based on query types
    if (baselineInfo.types.includes('yearly') && baselineInfo.years.length > 0) {
      // If using year-based queries, auto-configure yearly enforcement
      enhancedEnforcement.mode = 'yearly';
      enhancedEnforcement['auto-yearly-rules'] = this.generateYearlyRulesFromQueries(baselineInfo.years);
      core.info(`Auto-configured yearly enforcement for years: ${baselineInfo.years.join(', ')}`);
    } else if (baselineInfo.types.includes('widely')) {
      // If using "widely available", focus on strict enforcement
      enhancedEnforcement.mode = 'per-feature';
      enhancedEnforcement['baseline-threshold'] = 'widely';
      core.info('Auto-configured strict enforcement for "widely available" features');
    } else if (baselineInfo.types.includes('newly')) {
      // If using "newly available", use balanced enforcement
      enhancedEnforcement.mode = 'per-feature';
      enhancedEnforcement['baseline-threshold'] = 'newly';
      core.info('Auto-configured balanced enforcement for "newly available" features');
    }

    // Merge the enhanced enforcement into config
    if (!this.config.enforcement) {
      this.config.enforcement = {};
    }
    Object.assign(this.config.enforcement, enhancedEnforcement);
  }

  /**
   * Generate yearly enforcement rules based on detected Baseline year queries
   * @param {Array<number>} years - Years detected from baseline queries
   * @returns {Object} Yearly enforcement rules
   */
  generateYearlyRulesFromQueries(years) {
    const rules = {};
    const currentYear = new Date().getFullYear();
    
    // For each detected year, create appropriate enforcement levels
    for (const year of years) {
      const age = currentYear - year;
      
      if (age >= 3) {
        rules[year] = 'error';  // 3+ years old: strict enforcement
      } else if (age >= 2) {
        rules[year] = 'warn';   // 2+ years old: warnings
      } else if (age >= 1) {
        rules[year] = 'info';   // 1+ years old: informational
      } else {
        rules[year] = 'off';    // Current year: no enforcement
      }
    }

    // Add intelligent rules for years not explicitly specified
    // Assume stricter enforcement for older years
    const minYear = Math.min(...years);
    for (let year = minYear - 2; year < minYear; year++) {
      if (year >= 2015) { // Don't go too far back
        rules[year] = 'error';
      }
    }

    // Add lenient rules for newer years
    const maxYear = Math.max(...years);
    for (let year = maxYear + 1; year <= currentYear; year++) {
      const age = currentYear - year;
      if (age >= 1) {
        rules[year] = 'info';
      } else {
        rules[year] = 'off';
      }
    }

    return rules;
  }

  /**
   * Evaluate detected features against Baseline policies
   * @param {Array} detectedFeatures - Array of detected features
   * @returns {Promise<Array>} Array of violations
   */
  async evaluateFeatures(detectedFeatures) {
    this.violations = [];
    
    core.info(`Evaluating ${detectedFeatures.length} detected features against Baseline policies`);
    
    for (const feature of detectedFeatures) {
      await this.evaluateFeature(feature);
    }

    // Sort violations by severity and location
    this.violations.sort((a, b) => {
      const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      // Sort by file, then line number
      if (a.feature.file !== b.feature.file) {
        return a.feature.file.localeCompare(b.feature.file);
      }
      
      return (a.feature.location.line || 0) - (b.feature.location.line || 0);
    });

    core.info(`Found ${this.violations.length} Baseline compliance violations`);
    return this.violations;
  }

  /**
   * Alias for evaluateFeatures to maintain backward compatibility
   * @param {Array} detectedFeatures - Array of detected features
   * @param {Object} config - Configuration object (merged with existing config)
   * @returns {Promise<Object>} Evaluation result with violations, score, and summary
   */
  async evaluate(detectedFeatures, config = {}) {
    // Temporarily merge config
    const originalConfig = this.mergedConfig;
    if (Object.keys(config).length > 0) {
      this.mergedConfig = this.mergeConfigs(this.mergedConfig, config);
    }
    
    try {
      const violations = await this.evaluateFeatures(detectedFeatures);
      const complianceScore = this.calculateComplianceScore(detectedFeatures, violations);
      const summary = this.getViolationsSummary();
      summary.totalFeatures = detectedFeatures.length;
      
      return {
        violations,
        complianceScore,
        summary
      };
    } finally {
      // Restore original config
      this.mergedConfig = originalConfig;
    }
  }

  /**
   * Evaluate a single feature
   * @param {Object} feature - Feature to evaluate
   */
  async evaluateFeature(feature) {
    if (!feature.featureId) {
      core.debug(`Skipping feature without featureId: ${feature.name}`);
      return;
    }

    // Get Baseline status for this feature
    const baselineStatus = this.baselineDataManager.getBaselineStatus(feature.featureId);
    const featureInfo = this.baselineDataManager.getFeatureInfo(feature.featureId);
    
    if (baselineStatus === 'unknown') {
      core.debug(`Unknown Baseline status for feature: ${feature.featureId}`);
      return;
    }

    const enforcementMode = this.mergedConfig.enforcement.mode;
    
    if (enforcementMode === 'yearly' || enforcementMode === 'hybrid') {
      // Use yearly enforcement
      const violationLevel = this.getYearlyEnforcementLevel(feature, featureInfo);
      
      if (violationLevel && violationLevel !== 'off') {
        // Check for exceptions
        if (this.isExceptionAllowed(feature)) {
          core.debug(`Feature ${feature.featureId} allowed as exception`);
          return;
        }

        // Create yearly violation
        const violation = await this.createYearlyViolation(feature, baselineStatus, violationLevel, featureInfo);
        this.violations.push(violation);
      }
    }
    
    if (enforcementMode === 'per-feature' || enforcementMode === 'hybrid') {
      // Use traditional per-feature enforcement
      const requiredThreshold = this.getThresholdForFeature(feature);
      
      // Check if feature meets threshold
      if (!this.meetsThreshold(baselineStatus, requiredThreshold)) {
        // Check for exceptions
        if (this.isExceptionAllowed(feature)) {
          core.debug(`Feature ${feature.featureId} allowed as exception`);
          return;
        }

        // Create violation
        const violation = await this.createViolation(feature, baselineStatus, requiredThreshold, featureInfo);
        this.violations.push(violation);
      }
    }
  }

  /**
   * Create a violation object
   * @param {Object} feature - Feature that violates policy
   * @param {string} currentStatus - Current Baseline status
   * @param {string} requiredStatus - Required Baseline status
   * @param {Object} featureInfo - Additional feature information
   * @returns {Promise<Object>} Violation object
   */
  async createViolation(feature, currentStatus, requiredStatus, featureInfo) {
    const severity = this.calculateSeverity(currentStatus, requiredStatus, feature);
    const remediation = await this.generateRemediation(feature, currentStatus, featureInfo);
    
    return {
      feature: feature,
      currentStatus: currentStatus,
      requiredStatus: requiredStatus,
      severity: severity,
      remediation: remediation,
      featureInfo: featureInfo,
      violationId: this.generateViolationId(feature),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if current status meets required threshold
   * @param {string} currentStatus - Current Baseline status
   * @param {string} requiredThreshold - Required threshold
   * @returns {boolean} True if threshold is met
   */
  meetsThreshold(currentStatus, requiredThreshold) {
    const statusOrder = ['limited', 'newly', 'widely'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const requiredIndex = statusOrder.indexOf(requiredThreshold);
    
    if (currentIndex === -1 || requiredIndex === -1) {
      return false;
    }
    
    return currentIndex >= requiredIndex;
  }

  /**
   * Get the required threshold for a feature
   * @param {Object} feature - Feature object
   * @returns {string} Required threshold
   */
  getThresholdForFeature(feature) {
    const featureType = this.getFeatureType(feature);
    const rules = this.mergedConfig.rules[featureType];
    
    if (!rules) {
      return this.mergedConfig.rules.css['baseline-threshold']; // Default fallback
    }
    
    return rules['baseline-threshold'];
  }

  /**
   * Get yearly enforcement level for a feature
   * @param {Object} feature - Feature object
   * @param {Object} featureInfo - Feature information from baseline data
   * @returns {string|null} Enforcement level ('error', 'warn', 'info', 'off') or null if no enforcement
   */
  getYearlyEnforcementLevel(feature, featureInfo) {
    if (!featureInfo?.baseline?.low_date) {
      core.debug(`No baseline date for feature: ${feature.featureId}`);
      return null;
    }

    const baselineYear = new Date(featureInfo.baseline.low_date).getFullYear();
    const yearlyRules = this.mergedConfig.enforcement['yearly-rules'];
    
    // Check if we have a specific rule for this year
    if (yearlyRules[baselineYear]) {
      let level = yearlyRules[baselineYear];
      
      // Apply interop priority boost if enabled
      if (this.mergedConfig.enforcement['interop-priority'] && this.isInteropFeature(feature.featureId)) {
        level = this.boostEnforcementLevel(level);
      }
      
      return level;
    }
    
    // Calculate enforcement level based on age
    const currentYear = new Date().getFullYear();
    const age = currentYear - baselineYear;
    
    let level;
    if (age >= 3) level = 'error';      // 3+ years old
    else if (age >= 2) level = 'warn';  // 2-3 years old
    else if (age >= 1) level = 'info';  // 1-2 years old
    else level = 'off';                 // Less than 1 year old
    
    // Apply interop priority boost if enabled
    if (this.mergedConfig.enforcement['interop-priority'] && this.isInteropFeature(feature.featureId)) {
      level = this.boostEnforcementLevel(level);
    }
    
    return level;
  }

  /**
   * Check if a feature is a top interop issue
   * @param {string} featureId - Feature ID
   * @returns {boolean} True if it's a top interop feature
   */
  isInteropFeature(featureId) {
    const topInteropFeatures = [
      'anchor-positioning', 'container-queries', 'has', 'nesting', 
      'view-transitions', 'subgrid', 'grid', 'scrollbar-gutter',
      'scrollbar-width', 'scrollbar-color', 'scroll-driven-animations', 'scope',
      'popover', 'dialog', 'datalist', 'customized-built-in-elements', 
      'file-system-access', 'notifications', 'web-bluetooth'
    ];
    
    return topInteropFeatures.includes(featureId);
  }

  /**
   * Boost enforcement level by one step
   * @param {string} level - Current level ('off', 'info', 'warn', 'error')
   * @returns {string} Boosted level
   */
  boostEnforcementLevel(level) {
    const levelOrder = ['off', 'info', 'warn', 'error'];
    const currentIndex = levelOrder.indexOf(level);
    
    if (currentIndex === -1 || currentIndex === levelOrder.length - 1) {
      return level; // Can't boost unknown or already max level
    }
    
    return levelOrder[currentIndex + 1];
  }

  /**
   * Create a yearly violation object
   * @param {Object} feature - Feature that violates policy
   * @param {string} currentStatus - Current Baseline status
   * @param {string} violationLevel - Yearly enforcement level
   * @param {Object} featureInfo - Additional feature information
   * @returns {Promise<Object>} Violation object
   */
  async createYearlyViolation(feature, currentStatus, violationLevel, featureInfo) {
    const baselineYear = featureInfo?.baseline?.low_date ? 
      new Date(featureInfo.baseline.low_date).getFullYear() : null;
    const currentYear = new Date().getFullYear();
    const age = baselineYear ? currentYear - baselineYear : null;
    
    const severity = this.mapViolationLevelToSeverity(violationLevel);
    const remediation = await this.generateYearlyRemediation(feature, currentStatus, violationLevel, age, featureInfo);
    
    return {
      feature: feature,
      currentStatus: currentStatus,
      violationType: 'yearly',
      violationLevel: violationLevel,
      baselineYear: baselineYear,
      featureAge: age,
      severity: severity,
      remediation: remediation,
      featureInfo: featureInfo,
      violationId: this.generateViolationId(feature),
      timestamp: new Date().toISOString(),
      message: this.generateYearlyViolationMessage(feature, violationLevel, baselineYear, age)
    };
  }

  /**
   * Map violation level to severity
   * @param {string} violationLevel - Violation level ('error', 'warn', 'info')
   * @returns {string} Severity ('high', 'medium', 'low')
   */
  mapViolationLevelToSeverity(violationLevel) {
    const mapping = {
      'error': 'high',
      'warn': 'medium', 
      'info': 'low',
      'off': 'low'
    };
    
    return mapping[violationLevel] || 'medium';
  }

  /**
   * Generate yearly violation message
   * @param {Object} feature - Feature object
   * @param {string} violationLevel - Violation level
   * @param {number} baselineYear - Year feature became baseline
   * @param {number} age - Age of feature in years
   * @returns {string} Violation message
   */
  generateYearlyViolationMessage(feature, violationLevel, baselineYear, age) {
    if (!baselineYear) {
      return `Feature '${feature.featureId}' used but no baseline year available`;
    }
    
    const ageText = age ? `${age} year${age > 1 ? 's' : ''} old` : 'recent';
    
    switch (violationLevel) {
    case 'error':
      return `Feature '${feature.featureId}' from Baseline ${baselineYear} (${ageText}) - enforcement required`;
    case 'warn':
      return `Feature '${feature.featureId}' from Baseline ${baselineYear} (${ageText}) - consider adopting`;
    case 'info':
      return `Feature '${feature.featureId}' from Baseline ${baselineYear} (${ageText}) - informational`;
    default:
      return `Feature '${feature.featureId}' from Baseline ${baselineYear} (${ageText})`;
    }
  }

  /**
   * Generate yearly remediation suggestions
   * @param {Object} feature - Feature object
   * @param {string} currentStatus - Current baseline status
   * @param {string} violationLevel - Violation level
   * @param {number} age - Feature age in years
   * @param {Object} featureInfo - Feature information
   * @returns {Promise<Object>} Remediation object
   */
  async generateYearlyRemediation(feature, currentStatus, violationLevel, age, featureInfo) {
    const baseRemediation = await this.generateRemediation(feature, currentStatus, featureInfo);
    
    // Add yearly-specific recommendations
    baseRemediation.yearlyRecommendations = [];
    
    if (violationLevel === 'error' && age >= 3) {
      baseRemediation.yearlyRecommendations.push({
        type: 'adoption',
        message: `This feature has been baseline for ${age} years - strongly consider adoption`,
        urgency: 'high'
      });
    } else if (violationLevel === 'warn' && age >= 2) {
      baseRemediation.yearlyRecommendations.push({
        type: 'evaluation',
        message: `This feature has been baseline for ${age} years - evaluate for adoption`,
        urgency: 'medium'
      });
    } else if (violationLevel === 'info') {
      baseRemediation.yearlyRecommendations.push({
        type: 'awareness',
        message: 'This feature became baseline recently - monitor for future adoption',
        urgency: 'low'
      });
    }
    
    // Add interop-specific recommendations
    if (this.isInteropFeature(feature.featureId)) {
      baseRemediation.yearlyRecommendations.push({
        type: 'interop',
        message: 'This is a top interoperability issue - prioritize for cross-browser consistency',
        urgency: 'high'
      });
    }
    
    return baseRemediation;
  }

  /**
   * Get feature type from feature object
   * @param {Object} feature - Feature object
   * @returns {string} Feature type (css, javascript, html)
   */
  getFeatureType(feature) {
    if (feature.type.startsWith('css-')) return 'css';
    if (feature.type.startsWith('js-')) return 'javascript';
    if (feature.type.startsWith('html-')) return 'html';
    return 'css'; // Default fallback
  }

  /**
   * Check if a feature is allowed as an exception
   * @param {Object} feature - Feature to check
   * @returns {boolean} True if exception is allowed
   */
  isExceptionAllowed(feature) {
    const featureType = this.getFeatureType(feature);
    const rules = this.mergedConfig.rules[featureType];
    
    if (!rules || !rules['allowed-exceptions']) {
      return false;
    }
    
    return rules['allowed-exceptions'].some(exception => {
      // Check feature match
      if (exception.feature && exception.feature !== feature.featureId) {
        return false;
      }
      
      // Check file pattern match
      if (exception.files) {
        const micromatch = require('micromatch');
        return exception.files.some(pattern => 
          micromatch.isMatch(feature.file, pattern)
        );
      }
      
      return true;
    });
  }

  /**
   * Calculate severity of a violation
   * @param {string} currentStatus - Current Baseline status
   * @param {string} requiredStatus - Required Baseline status
   * @param {Object} feature - Feature object
   * @returns {string} Severity level (low, medium, high)
   */
  calculateSeverity(currentStatus, requiredStatus, _feature) {
    const statusOrder = ['limited', 'newly', 'widely'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const requiredIndex = statusOrder.indexOf(requiredStatus);
    
    const gap = requiredIndex - currentIndex;
    
    // Higher gap = higher severity
    if (gap >= 2) return 'high';
    if (gap >= 1) return 'medium';
    return 'low';
  }

  /**
   * Generate remediation suggestions for a violation
   * @param {Object} feature - Feature object
   * @param {string} currentStatus - Current Baseline status
   * @param {Object} featureInfo - Feature information from Baseline data
   * @returns {Promise<Object>} Remediation object
   */
  async generateRemediation(feature, currentStatus, featureInfo) {
    const remediation = {
      polyfillSuggestions: [],
      alternativeFeatures: [],
      progressiveEnhancement: null,
      estimatedAvailabilityDate: null,
      documentation: [],
      codeExamples: []
    };

    // Generate polyfill suggestions
    remediation.polyfillSuggestions = this.suggestPolyfills(feature);
    
    // Suggest alternative features
    remediation.alternativeFeatures = this.suggestAlternatives(feature);
    
    // Progressive enhancement suggestions
    remediation.progressiveEnhancement = this.suggestProgressive(feature);
    
    // Estimate when feature might become widely available
    if (featureInfo && currentStatus === 'newly') {
      remediation.estimatedAvailabilityDate = this.estimateWidelyAvailableDate(featureInfo);
    }
    
    // Add documentation links
    if (featureInfo && featureInfo.mdn_url) {
      remediation.documentation.push({
        title: 'MDN Documentation',
        url: featureInfo.mdn_url
      });
    }
    
    // Add spec links
    if (featureInfo && featureInfo.spec) {
      remediation.documentation.push({
        title: 'Specification',
        url: featureInfo.spec.url || featureInfo.spec
      });
    }
    
    // Generate code examples
    remediation.codeExamples = this.generateCodeExamples(feature);
    
    return remediation;
  }

  /**
   * Suggest polyfills for a feature
   * @param {Object} feature - Feature object
   * @returns {Array} Array of polyfill suggestions
   */
  suggestPolyfills(feature) {
    const polyfillMap = {
      'fetch-api': ['whatwg-fetch', 'isomorphic-fetch'],
      'intersection-observer': ['intersection-observer'],
      'resize-observer': ['resize-observer-polyfill'],
      'css-custom-properties': ['css-vars-ponyfill'],
      'css-grid': ['css-grid-polyfill'],
      'css-container-queries': ['container-query-polyfill'],
      'web-components': ['@webcomponents/webcomponentsjs'],
      'url-search-params': ['url-search-params-polyfill']
    };
    
    return polyfillMap[feature.featureId] || [];
  }

  /**
   * Suggest alternative features
   * @param {Object} feature - Feature object
   * @returns {Array} Array of alternative feature suggestions
   */
  suggestAlternatives(feature) {
    const alternativeMap = {
      'css-grid': ['css-flexbox', 'css-float-layout'],
      'css-container-queries': ['css-media-queries'],
      'css-has-pseudo': ['css-descendant-selectors'],
      'intersection-observer': ['scroll-event-listeners'],
      'resize-observer': ['window-resize-events'],
      'web-share': ['clipboard-api', 'mailto-links']
    };
    
    return alternativeMap[feature.featureId] || [];
  }

  /**
   * Suggest progressive enhancement approach
   * @param {Object} feature - Feature object
   * @returns {Object|null} Progressive enhancement suggestion
   */
  suggestProgressive(feature) {
    const progressiveMap = {
      'css-grid': {
        approach: 'Feature Detection',
        description: 'Use @supports (display: grid) to apply grid layout with flexbox fallback',
        example: '@supports not (display: grid) { .container { display: flex; } }'
      },
      'intersection-observer': {
        approach: 'Feature Detection',
        description: 'Check for IntersectionObserver support and fallback to scroll listeners',
        example: 'if (\'IntersectionObserver\' in window) { /* use observer */ } else { /* scroll fallback */ }'
      },
      'css-custom-properties': {
        approach: 'Preprocessor Variables',
        description: 'Use CSS preprocessor variables as fallback for custom properties',
        example: 'Use Sass/Less variables alongside CSS custom properties'
      }
    };
    
    return progressiveMap[feature.featureId] || null;
  }

  /**
   * Estimate when a feature might become widely available
   * @param {Object} featureInfo - Feature information
   * @returns {string|null} Estimated date
   */
  estimateWidelyAvailableDate(featureInfo) {
    // This is a simplified estimation - in reality, this would use more sophisticated analysis
    if (featureInfo.baseline && featureInfo.baseline.since) {
      const sinceDate = new Date(featureInfo.baseline.since);
      // Rough estimate: 18 months from newly available to widely available
      const estimatedDate = new Date(sinceDate);
      estimatedDate.setMonth(estimatedDate.getMonth() + 18);
      return estimatedDate.toISOString().split('T')[0];
    }
    
    return null;
  }

  /**
   * Generate code examples for remediation
   * @param {Object} feature - Feature object
   * @returns {Array} Array of code examples
   */
  generateCodeExamples(feature) {
    const examples = [];
    
    // Add feature detection example
    if (feature.type.startsWith('js-')) {
      examples.push({
        title: 'Feature Detection',
        code: this.generateJSFeatureDetectionCode(feature),
        language: 'javascript'
      });
    } else if (feature.type.startsWith('css-')) {
      examples.push({
        title: 'CSS Feature Query',
        code: this.generateCSSFeatureQueryCode(feature),
        language: 'css'
      });
    }
    
    return examples;
  }

  /**
   * Generate JavaScript feature detection code
   * @param {Object} feature - Feature object
   * @returns {string} JavaScript code
   */
  generateJSFeatureDetectionCode(feature) {
    const detectionMap = {
      'fetch-api': 'if (\'fetch\' in window) { /* use fetch */ } else { /* use XMLHttpRequest */ }',
      'intersection-observer': 'if (\'IntersectionObserver\' in window) { /* use observer */ } else { /* scroll fallback */ }',
      'resize-observer': 'if (\'ResizeObserver\' in window) { /* use observer */ } else { /* resize event fallback */ }'
    };
    
    return detectionMap[feature.featureId] || `// Feature detection for ${feature.name}`;
  }

  /**
   * Generate CSS feature query code
   * @param {Object} feature - Feature object
   * @returns {string} CSS code
   */
  generateCSSFeatureQueryCode(feature) {
    const queryMap = {
      'css-grid': '@supports (display: grid) { .container { display: grid; } }',
      'css-custom-properties': '@supports (--custom: value) { .element { color: var(--primary-color); } }',
      'css-container-queries': '@supports (container-type: inline-size) { @container (min-width: 300px) { /* styles */ } }'
    };
    
    return queryMap[feature.featureId] || `/* Feature query for ${feature.name} */`;
  }

  /**
   * Generate a unique violation ID
   * @param {Object} feature - Feature object
   * @returns {string} Violation ID
   */
  generateViolationId(feature) {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${feature.featureId}-${feature.file}-${feature.location.line}-${feature.location.column}`)
      .digest('hex');
    
    return hash.substring(0, 8);
  }

  /**
   * Calculate compliance score
   * @param {Array} allFeatures - All detected features
   * @param {Array} violations - Violations found
   * @returns {number} Compliance score (0-100)
   */
  calculateComplianceScore(allFeatures, violations) {
    if (allFeatures.length === 0) return 100;
    
    let totalWeight = 0;
    let violationWeight = 0;
    
    totalWeight = allFeatures.length;
    
    for (const violation of violations) {
      const weight = this.mergedConfig.enforcement['severity-weights'][violation.severity] || 1;
      violationWeight += weight;
    }
    
    const score = Math.max(0, Math.round((1 - violationWeight / totalWeight) * 100));
    return score;
  }

  /**
   * Get violations summary
   * @returns {Object} Violations summary
   */
  getViolationsSummary() {
    const summary = {
      total: this.violations.length,
      byFeatureType: {},
      bySeverity: { high: 0, medium: 0, low: 0 },
      byFile: {}
    };
    
    for (const violation of this.violations) {
      // By feature type
      const featureType = this.getFeatureType(violation.feature);
      summary.byFeatureType[featureType] = (summary.byFeatureType[featureType] || 0) + 1;
      
      // By severity
      summary.bySeverity[violation.severity] = (summary.bySeverity[violation.severity] || 0) + 1;
      
      // By file
      const fileName = violation.feature.file;
      summary.byFile[fileName] = (summary.byFile[fileName] || 0) + 1;
    }
    
    return summary;
  }

  /**
   * Merge configuration objects
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User provided configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigs(defaultConfig, userConfig) {
    return this.deepMerge(defaultConfig, userConfig || {});
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
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Reset policy engine state
   */
  reset() {
    this.violations = [];
  }
}

module.exports = PolicyEngine;