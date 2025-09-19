const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const core = require('@actions/core');
const {
  getCSSPropertyFeature,
  getCSSSelectorFeature,
  getCSSFunctionFeature,
  getCSSAtRuleFeature
} = require('../utils/feature-mappings');

/**
 * Detects CSS features in stylesheets and maps them to Baseline identifiers
 */
class CSSFeatureDetector {
  constructor(options = {}) {
    this.postcss = postcss();
    this.detectedFeatures = new Set();
    this.options = {
      includeVendorPrefixes: options.includeVendorPrefixes !== false,
      includeExperimentalFeatures: options.includeExperimentalFeatures !== false,
      ...options
    };
  }

  /**
   * Detect CSS features in a stylesheet
   * @param {string} cssContent - CSS content to analyze
   * @param {string} filePath - File path for reporting
   * @returns {Promise<Array>} Array of detected features
   */
  async detectFeatures(cssContent, filePath) {
    const features = [];
    this.detectedFeatures.clear();

    try {
      const ast = this.postcss.process(cssContent, { 
        from: filePath
      }).root;

      // Detect features in the AST
      await this.walkAST(ast, filePath, features);

      core.debug(`Detected ${features.length} CSS features in ${filePath}`);
      return features;
    } catch (error) {
      core.warning(`Failed to parse CSS in ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Walk through the PostCSS AST and detect features
   * @param {Object} ast - PostCSS AST
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  async walkAST(ast, filePath, features) {
    ast.walk(node => {
      try {
        switch (node.type) {
          case 'decl':
            this.detectDeclarationFeatures(node, filePath, features);
            break;
          case 'rule':
            this.detectSelectorFeatures(node, filePath, features);
            break;
          case 'atrule':
            this.detectAtRuleFeatures(node, filePath, features);
            break;
        }
      } catch (error) {
        core.debug(`Error processing ${node.type} in ${filePath}: ${error.message}`);
      }
    });
  }

  /**
   * Detect features in CSS declarations (properties and values)
   * @param {Object} decl - PostCSS declaration node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectDeclarationFeatures(decl, filePath, features) {
    const property = decl.prop;
    const value = decl.value;
    const location = this.getNodeLocation(decl);

    // Detect CSS properties
    const propertyFeature = getCSSPropertyFeature(property, value);
    if (propertyFeature && !this.isFeatureDetected(propertyFeature, location)) {
      features.push({
        type: 'css-property',
        name: property,
        value: value,
        featureId: propertyFeature,
        location: location,
        file: filePath,
        context: this.getDeclarationContext(decl)
      });
      this.markFeatureDetected(propertyFeature, location);
    }

    // Detect CSS functions in values
    this.detectValueFeatures(value, filePath, features, location, decl);

    // Detect vendor prefixes
    if (this.options.includeVendorPrefixes && this.isVendorPrefixed(property)) {
      const unprefixed = this.removeVendorPrefix(property);
      const unprefixedFeature = getCSSPropertyFeature(unprefixed, value);
      
      if (unprefixedFeature && !this.isFeatureDetected(unprefixedFeature, location)) {
        features.push({
          type: 'css-property',
          name: unprefixed,
          value: value,
          featureId: unprefixedFeature,
          location: location,
          file: filePath,
          vendorPrefixed: true,
          originalProperty: property,
          context: this.getDeclarationContext(decl)
        });
        this.markFeatureDetected(unprefixedFeature, location);
      }
    }
  }

  /**
   * Detect features in CSS values (functions, keywords, etc.)
   * @param {string} value - CSS value
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} context - AST context node
   */
  detectValueFeatures(value, filePath, features, location, context) {
    // Detect CSS functions
    const functionMatches = value.matchAll(/([a-z-]+)\(/gi);
    for (const match of functionMatches) {
      const functionName = match[1].toLowerCase() + '(';
      const featureId = getCSSFunctionFeature(functionName);
      
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'css-function',
          name: functionName.slice(0, -1), // Remove trailing parenthesis
          value: this.extractFunctionCall(value, match.index),
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getDeclarationContext(context)
        });
        this.markFeatureDetected(featureId, location);
      }
    }

    // Detect CSS custom properties (variables)
    const customPropMatches = value.matchAll(/var\(([^)]+)\)/g);
    for (const match of customPropMatches) {
      const featureId = 'css-custom-properties';
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'css-custom-property',
          name: 'var',
          value: match[1],
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getDeclarationContext(context)
        });
        this.markFeatureDetected(featureId, location);
      }
    }

    // Detect CSS keywords that might be features
    this.detectKeywordFeatures(value, filePath, features, location, context);
  }

  /**
   * Detect features in CSS selectors
   * @param {Object} rule - PostCSS rule node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectSelectorFeatures(rule, filePath, features) {
    const selector = rule.selector;
    const location = this.getNodeLocation(rule);

    try {
      selectorParser(selectors => {
        selectors.walk(node => {
          if (node.type === 'pseudo') {
            const pseudoSelector = node.toString();
            const featureId = getCSSSelectorFeature(pseudoSelector);
            
            if (featureId && !this.isFeatureDetected(featureId, location)) {
              features.push({
                type: 'css-selector',
                name: pseudoSelector,
                featureId: featureId,
                location: location,
                file: filePath,
                fullSelector: selector,
                context: this.getRuleContext(rule)
              });
              this.markFeatureDetected(featureId, location);
            }
          }
        });
      }).processSync(selector);
    } catch (error) {
      // Fallback to simple string matching for complex selectors
      const featureId = getCSSSelectorFeature(selector);
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'css-selector',
          name: selector,
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getRuleContext(rule)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect features in CSS at-rules
   * @param {Object} atrule - PostCSS at-rule node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectAtRuleFeatures(atrule, filePath, features) {
    const atRuleName = '@' + atrule.name;
    const params = atrule.params;
    const location = this.getNodeLocation(atrule);

    // Check for specific at-rule features
    const featureId = getCSSAtRuleFeature(atRuleName, params);
    
    if (featureId && !this.isFeatureDetected(featureId, location)) {
      features.push({
        type: 'css-at-rule',
        name: atRuleName,
        params: params,
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getAtRuleContext(atrule)
      });
      this.markFeatureDetected(featureId, location);
    }

    // Special handling for @media queries
    if (atrule.name === 'media') {
      this.detectMediaQueryFeatures(params, filePath, features, location, atrule);
    }

    // Special handling for @supports queries
    if (atrule.name === 'supports') {
      this.detectSupportsQueryFeatures(params, filePath, features, location, atrule);
    }
  }

  /**
   * Detect features in media query conditions
   * @param {string} mediaQuery - Media query string
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} context - AST context node
   */
  detectMediaQueryFeatures(mediaQuery, filePath, features, location, context) {
    // Common media query features that map to Baseline
    const mediaFeatures = [
      'prefers-color-scheme',
      'prefers-reduced-motion',
      'prefers-contrast',
      'prefers-reduced-data',
      'hover',
      'any-hover',
      'pointer',
      'any-pointer',
      'resolution',
      'aspect-ratio'
    ];

    for (const feature of mediaFeatures) {
      if (mediaQuery.includes(feature)) {
        const featureId = getCSSAtRuleFeature('@media', feature);
        if (featureId && !this.isFeatureDetected(featureId, location)) {
          features.push({
            type: 'css-media-feature',
            name: feature,
            featureId: featureId,
            location: location,
            file: filePath,
            mediaQuery: mediaQuery,
            context: this.getAtRuleContext(context)
          });
          this.markFeatureDetected(featureId, location);
        }
      }
    }
  }

  /**
   * Detect features in @supports queries
   * @param {string} supportsQuery - Supports query string
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} context - AST context node
   */
  detectSupportsQueryFeatures(supportsQuery, filePath, features, location, context) {
    // Extract property-value pairs from supports query
    const propertyMatches = supportsQuery.matchAll(/\(([^:]+):\s*([^)]+)\)/g);
    
    for (const match of propertyMatches) {
      const property = match[1].trim();
      const value = match[2].trim();
      const featureId = getCSSPropertyFeature(property, value);
      
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'css-supports-query',
          name: property,
          value: value,
          featureId: featureId,
          location: location,
          file: filePath,
          supportsQuery: supportsQuery,
          context: this.getAtRuleContext(context)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect CSS keyword features
   * @param {string} value - CSS value
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} context - AST context node
   */
  detectKeywordFeatures(value, filePath, features, location, context) {
    // Keywords that indicate specific features (mapped to web-features IDs)
    const keywordFeatures = {
      'grid': 'grid',
      'subgrid': null,  // subgrid is not in web-features yet
      'flex': 'flexbox',
      'inline-flex': 'flexbox',
      'contents': 'display-contents'
    };

    for (const [keyword, featureId] of Object.entries(keywordFeatures)) {
      // Use word boundary matching to avoid partial matches (e.g., "subgrid" shouldn't match "grid")
      const keywordRegex = new RegExp(`\\b${keyword}\\b`);
      if (keywordRegex.test(value) && featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'css-keyword',
          name: keyword,
          featureId: featureId,
          location: location,
          file: filePath,
          value: value,
          context: this.getDeclarationContext(context)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Check if a feature has already been detected at this location
   * @param {string} featureId - Feature ID
   * @param {Object} location - Source location
   * @returns {boolean} True if feature already detected
   */
  isFeatureDetected(featureId, location) {
    const key = `${featureId}:${location.line}:${location.column}`;
    return this.detectedFeatures.has(key);
  }

  /**
   * Mark a feature as detected
   * @param {string} featureId - Feature ID
   * @param {Object} location - Source location
   */
  markFeatureDetected(featureId, location) {
    const key = `${featureId}:${location.line}:${location.column}`;
    this.detectedFeatures.add(key);
  }

  /**
   * Get source location from PostCSS node
   * @param {Object} node - PostCSS node
   * @returns {Object} Location object
   */
  getNodeLocation(node) {
    return {
      line: node.source?.start?.line || 1,
      column: node.source?.start?.column || 1,
      endLine: node.source?.end?.line,
      endColumn: node.source?.end?.column
    };
  }

  /**
   * Get context information for a declaration
   * @param {Object} decl - PostCSS declaration node
   * @returns {Object} Context information
   */
  getDeclarationContext(decl) {
    return {
      property: decl.prop,
      value: decl.value,
      important: decl.important,
      selector: decl.parent?.selector,
      ruleType: decl.parent?.type
    };
  }

  /**
   * Get context information for a rule
   * @param {Object} rule - PostCSS rule node
   * @returns {Object} Context information
   */
  getRuleContext(rule) {
    return {
      selector: rule.selector,
      declarationCount: rule.nodes?.length || 0,
      parent: rule.parent?.type
    };
  }

  /**
   * Get context information for an at-rule
   * @param {Object} atrule - PostCSS at-rule node
   * @returns {Object} Context information
   */
  getAtRuleContext(atrule) {
    return {
      name: atrule.name,
      params: atrule.params,
      hasBlock: !!atrule.nodes,
      parent: atrule.parent?.type
    };
  }

  /**
   * Check if a property is vendor prefixed
   * @param {string} property - CSS property name
   * @returns {boolean} True if vendor prefixed
   */
  isVendorPrefixed(property) {
    return /^-(webkit|moz|ms|o)-/.test(property);
  }

  /**
   * Remove vendor prefix from property
   * @param {string} property - Vendor prefixed property
   * @returns {string} Unprefixed property name
   */
  removeVendorPrefix(property) {
    return property.replace(/^-(webkit|moz|ms|o)-/, '');
  }

  /**
   * Extract a complete function call from CSS value
   * @param {string} value - CSS value
   * @param {number} startIndex - Start index of function name
   * @returns {string} Complete function call
   */
  extractFunctionCall(value, startIndex) {
    let parenCount = 0;
    let i = value.indexOf('(', startIndex);
    
    if (i === -1) return '';
    
    const start = value.lastIndexOf(' ', i) + 1;
    i++;
    parenCount = 1;
    
    while (i < value.length && parenCount > 0) {
      if (value[i] === '(') parenCount++;
      else if (value[i] === ')') parenCount--;
      i++;
    }
    
    return value.substring(start, i);
  }

  /**
   * Reset detector state
   */
  reset() {
    this.detectedFeatures.clear();
  }
}

module.exports = CSSFeatureDetector;