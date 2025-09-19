const babel = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const core = require('@actions/core');
const {
  getJSAPIFeature,
  getJSPropertyFeature
} = require('../utils/feature-mappings');

/**
 * Detects JavaScript features in code and maps them to Baseline identifiers
 */
class JSFeatureDetector {
  constructor(options = {}) {
    this.detectedFeatures = new Set();
    this.options = {
      includeExperimentalFeatures: options.includeExperimentalFeatures !== false,
      strictMode: options.strictMode !== false,
      ...options
    };
    
    // Babel parser options
    this.parserOptions = {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
        'optionalCatchBinding',
        'numericSeparator',
        'bigInt',
        'topLevelAwait'
      ]
    };
  }

  /**
   * Detect JavaScript features in code
   * @param {string} jsContent - JavaScript content to analyze
   * @param {string} filePath - File path for reporting
   * @returns {Promise<Array>} Array of detected features
   */
  async detectFeatures(jsContent, filePath) {
    const features = [];
    this.detectedFeatures.clear();

    try {
      // Handle different file extensions
      const parserOptions = { ...this.parserOptions };
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        parserOptions.plugins.push('typescript');
      }
      if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
        parserOptions.plugins.push('jsx');
      }

      const ast = babel.parse(jsContent, parserOptions);

      // Traverse the AST and detect features
      this.traverseAST(ast, filePath, features);

      core.debug(`Detected ${features.length} JavaScript features in ${filePath}`);
      return features;
    } catch (error) {
      core.warning(`Failed to parse JavaScript in ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Traverse the AST and detect features
   * @param {Object} ast - Babel AST
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  traverseAST(ast, filePath, features) {
    traverse(ast, {
      // Function calls (fetch, requestAnimationFrame, etc.)
      CallExpression: (path) => {
        this.detectCallExpressionFeatures(path, filePath, features);
      },

      // Property access (document.querySelector, navigator.clipboard, etc.)
      MemberExpression: (path) => {
        this.detectMemberExpressionFeatures(path, filePath, features);
      },

      // New expressions (new Worker, new IntersectionObserver, etc.)
      NewExpression: (path) => {
        this.detectNewExpressionFeatures(path, filePath, features);
      },

      // Import declarations
      ImportDeclaration: (path) => {
        this.detectImportFeatures(path, filePath, features);
      },

      // Object patterns and destructuring
      ObjectPattern: (path) => {
        this.detectObjectPatternFeatures(path, filePath, features);
      },

      // Array patterns and destructuring
      ArrayPattern: (path) => {
        this.detectArrayPatternFeatures(path, filePath, features);
      },

      // Async/await
      AwaitExpression: (path) => {
        this.detectAsyncAwaitFeatures(path, filePath, features);
      },

      // Arrow functions
      ArrowFunctionExpression: (path) => {
        this.detectArrowFunctionFeatures(path, filePath, features);
      },

      // Template literals
      TemplateLiteral: (path) => {
        this.detectTemplateLiteralFeatures(path, filePath, features);
      },

      // Spread syntax
      SpreadElement: (path) => {
        this.detectSpreadFeatures(path, filePath, features);
      },

      // Optional chaining
      OptionalMemberExpression: (path) => {
        this.detectOptionalChainingFeatures(path, filePath, features);
      },

      // Nullish coalescing
      LogicalExpression: (path) => {
        this.detectLogicalExpressionFeatures(path, filePath, features);
      },

      // Classes and class features
      ClassDeclaration: (path) => {
        this.detectClassFeatures(path, filePath, features);
      },

      // For-of loops
      ForOfStatement: (path) => {
        this.detectForOfFeatures(path, filePath, features);
      }
    });
  }

  /**
   * Detect features in function call expressions
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectCallExpressionFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);

    // Direct function calls
    if (node.callee.type === 'Identifier') {
      const functionName = node.callee.name;
      const featureId = getJSAPIFeature(functionName);
      
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'js-api-call',
          name: functionName,
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getCallContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }

    // Method calls
    if (node.callee.type === 'MemberExpression') {
      const memberAccess = this.getMemberExpressionString(node.callee);
      const featureId = getJSPropertyFeature(memberAccess);
      
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'js-method-call',
          name: memberAccess,
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getCallContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect features in member expressions
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectMemberExpressionFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    const memberAccess = this.getMemberExpressionString(node);
    
    const featureId = getJSPropertyFeature(memberAccess);
    if (featureId && !this.isFeatureDetected(featureId, location)) {
      features.push({
        type: 'js-property-access',
        name: memberAccess,
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getMemberContext(path)
      });
      this.markFeatureDetected(featureId, location);
    }
  }

  /**
   * Detect features in new expressions
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectNewExpressionFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);

    if (node.callee.type === 'Identifier') {
      const constructorName = node.callee.name;
      const featureId = getJSAPIFeature(constructorName);
      
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'js-constructor',
          name: constructorName,
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getNewExpressionContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect features in import declarations
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectImportFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    const source = node.source.value;

    // Dynamic imports are detected elsewhere, this is for static imports
    if (this.isWebPlatformImport(source)) {
      const featureId = this.getImportFeatureId(source);
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'js-import',
          name: source,
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getImportContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect features in object destructuring patterns
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectObjectPatternFeatures(path, filePath, features) {
    // This could detect destructuring of Web APIs
    // For now, we'll track it as a language feature
    const node = path.node;
    const location = this.getNodeLocation(node);
    
    if (node.properties.length > 0) {
      const detectorId = 'js-destructuring-object';
    const featureId = getJSAPIFeature(detectorId);
      if (!this.isFeatureDetected(detectorId, location)) {
        features.push({
          type: 'js-destructuring',
          name: 'object-destructuring',
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getDestructuringContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect features in array destructuring patterns
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectArrayPatternFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    
    if (node.elements.length > 0) {
      const detectorId = 'js-destructuring-array';
    const featureId = getJSAPIFeature(detectorId);
      if (!this.isFeatureDetected(detectorId, location)) {
        features.push({
          type: 'js-destructuring',
          name: 'array-destructuring',
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getDestructuringContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect async/await features
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectAsyncAwaitFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    const detectorId = 'js-async-await';
    const featureId = getJSAPIFeature(detectorId);
    
    if (!this.isFeatureDetected(detectorId, location)) {
      features.push({
        type: 'js-async-await',
        name: 'await',
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getAsyncContext(path)
      });
      this.markFeatureDetected(detectorId, location);
    }
  }

  /**
   * Detect arrow function features
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectArrowFunctionFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    const detectorId = 'js-arrow-functions';
    const featureId = getJSAPIFeature(detectorId);
    
    if (!this.isFeatureDetected(detectorId, location)) {
      features.push({
        type: 'js-arrow-function',
        name: 'arrow-function',
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getFunctionContext(path)
      });
      this.markFeatureDetected(detectorId, location);
    }
  }

  /**
   * Detect template literal features
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectTemplateLiteralFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    
    if (node.expressions.length > 0 || node.quasis.some(q => q.value.cooked.includes('\n'))) {
      const detectorId = 'js-template-literals';
    const featureId = getJSAPIFeature(detectorId);
      if (!this.isFeatureDetected(detectorId, location)) {
        features.push({
          type: 'js-template-literal',
          name: 'template-literal',
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getTemplateLiteralContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect spread syntax features
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectSpreadFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    const detectorId = 'js-spread-syntax';
    const featureId = getJSAPIFeature(detectorId);
    
    if (!this.isFeatureDetected(detectorId, location)) {
      features.push({
        type: 'js-spread',
        name: 'spread-syntax',
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getSpreadContext(path)
      });
      this.markFeatureDetected(detectorId, location);
    }
  }

  /**
   * Detect optional chaining features
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectOptionalChainingFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    const detectorId = 'js-optional-chaining';
    const featureId = getJSAPIFeature(detectorId);
    
    if (!this.isFeatureDetected(detectorId, location)) {
      features.push({
        type: 'js-optional-chaining',
        name: 'optional-chaining',
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getOptionalChainingContext(path)
      });
      this.markFeatureDetected(detectorId, location);
    }
  }

  /**
   * Detect logical expression features (nullish coalescing)
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectLogicalExpressionFeatures(path, filePath, features) {
    const node = path.node;
    
    if (node.operator === '??') {
      const location = this.getNodeLocation(node);
      const detectorId = 'js-nullish-coalescing';
    const featureId = getJSAPIFeature(detectorId);
      
      if (!this.isFeatureDetected(detectorId, location)) {
        features.push({
          type: 'js-nullish-coalescing',
          name: 'nullish-coalescing',
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getLogicalExpressionContext(path)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect class-related features
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectClassFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    
    // Basic class support
    const detectorId = 'js-classes';
    const featureId = getJSAPIFeature(detectorId);
    if (!this.isFeatureDetected(detectorId, location)) {
      features.push({
        type: 'js-class',
        name: 'class',
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getClassContext(path)
      });
      this.markFeatureDetected(detectorId, location);
    }

    // Check for class fields
    if (node.body.body.some(member => member.type === 'ClassProperty')) {
      const fieldDetectorId = 'js-class-fields';
      const fieldFeatureId = getJSAPIFeature(fieldDetectorId);
      if (!this.isFeatureDetected(fieldDetectorId, location)) {
        features.push({
          type: 'js-class-field',
          name: 'class-fields',
          featureId: fieldFeatureId,
          location: location,
          file: filePath,
          context: this.getClassContext(path)
        });
        this.markFeatureDetected(fieldDetectorId, location);
      }
    }
  }

  /**
   * Detect for-of loop features
   * @param {Object} path - Babel path
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  detectForOfFeatures(path, filePath, features) {
    const node = path.node;
    const location = this.getNodeLocation(node);
    const detectorId = 'js-for-of';
    const featureId = getJSAPIFeature(detectorId);
    
    if (!this.isFeatureDetected(detectorId, location)) {
      features.push({
        type: 'js-for-of',
        name: 'for-of',
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getForOfContext(path)
      });
      this.markFeatureDetected(detectorId, location);
    }
  }

  // Helper methods for context and location

  /**
   * Get member expression as a string
   * @param {Object} node - Member expression node
   * @returns {string} Member expression string
   */
  getMemberExpressionString(node) {
    if (node.type !== 'MemberExpression') return '';
    
    const object = node.object.type === 'Identifier' ? 
      node.object.name : 
      this.getMemberExpressionString(node.object);
      
    const property = node.computed ? 
      `[${node.property.name || node.property.value}]` :
      node.property.name;
      
    return `${object}.${property}`;
  }

  /**
   * Check if a feature has already been detected
   * @param {string} featureId - Feature ID
   * @param {Object} location - Source location
   * @returns {boolean} True if already detected
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
   * Get source location from AST node
   * @param {Object} node - AST node
   * @returns {Object} Location object
   */
  getNodeLocation(node) {
    return {
      line: node.loc?.start?.line || 1,
      column: node.loc?.start?.column || 1,
      endLine: node.loc?.end?.line,
      endColumn: node.loc?.end?.column
    };
  }

  /**
   * Check if an import is from a web platform API
   * @param {string} source - Import source
   * @returns {boolean} True if web platform import
   */
  isWebPlatformImport(source) {
    // This would need to be expanded based on actual web platform imports
    const webPlatformModules = ['@web/apis', 'web-apis'];
    return webPlatformModules.some(mod => source.startsWith(mod));
  }

  /**
   * Get feature ID for an import
   * @param {string} source - Import source
   * @returns {string|null} Feature ID or null
   */
  getImportFeatureId(source) {
    // Map import sources to feature IDs
    const importMapping = {
      '@web/apis/fetch': 'fetch-api',
      '@web/apis/workers': 'web-workers'
    };
    return importMapping[source] || null;
  }

  // Context methods for different types of features

  getCallContext(path) {
    return {
      callee: path.node.callee.name || 'anonymous',
      argumentCount: path.node.arguments.length,
      parentFunction: this.getParentFunction(path)
    };
  }

  getMemberContext(path) {
    return {
      object: path.node.object.name,
      property: path.node.property.name,
      computed: path.node.computed
    };
  }

  getNewExpressionContext(path) {
    return {
      constructor: path.node.callee.name,
      argumentCount: path.node.arguments.length
    };
  }

  getImportContext(path) {
    return {
      source: path.node.source.value,
      specifiers: path.node.specifiers.map(spec => spec.local.name)
    };
  }

  getDestructuringContext(path) {
    return {
      patternType: path.node.type,
      elementCount: path.node.properties?.length || path.node.elements?.length
    };
  }

  getAsyncContext(path) {
    return {
      inAsyncFunction: this.isInAsyncFunction(path)
    };
  }

  getFunctionContext(path) {
    return {
      async: path.node.async,
      generator: path.node.generator,
      parameterCount: path.node.params.length
    };
  }

  getTemplateLiteralContext(path) {
    return {
      expressionCount: path.node.expressions.length,
      hasNewlines: path.node.quasis.some(q => q.value.cooked.includes('\n'))
    };
  }

  getSpreadContext(path) {
    return {
      parentType: path.parent.type,
      argumentPosition: this.getArgumentPosition(path)
    };
  }

  getOptionalChainingContext(path) {
    return {
      memberExpression: this.getMemberExpressionString(path.node)
    };
  }

  getLogicalExpressionContext(path) {
    return {
      operator: path.node.operator,
      leftType: path.node.left.type,
      rightType: path.node.right.type
    };
  }

  getClassContext(path) {
    return {
      className: path.node.id?.name,
      superClass: path.node.superClass?.name,
      methodCount: path.node.body.body.length
    };
  }

  getForOfContext(path) {
    return {
      leftType: path.node.left.type,
      rightType: path.node.right.type
    };
  }

  // Utility helper methods

  getParentFunction(path) {
    let current = path.parent;
    while (current && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(current.type)) {
      current = current.parent;
    }
    return current?.type || 'global';
  }

  isInAsyncFunction(path) {
    let current = path.parent;
    while (current) {
      if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(current.type)) {
        return current.async || false;
      }
      current = current.parent;
    }
    return false;
  }

  getArgumentPosition(path) {
    if (path.parent.type === 'CallExpression') {
      return path.parent.arguments.indexOf(path.node);
    }
    return -1;
  }

  /**
   * Reset detector state
   */
  reset() {
    this.detectedFeatures.clear();
  }
}

module.exports = JSFeatureDetector;