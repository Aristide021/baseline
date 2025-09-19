const parse5 = require('parse5');
const core = require('@actions/core');
const { getHTMLFeature } = require('../utils/feature-mappings');

/**
 * Detects HTML features in markup and maps them to Baseline identifiers
 */
class HTMLFeatureDetector {
  constructor(options = {}) {
    this.detectedFeatures = new Set();
    this.options = {
      includeDataAttributes: options.includeDataAttributes !== false,
      includeAriaAttributes: options.includeAriaAttributes !== false,
      includeExperimentalFeatures: options.includeExperimentalFeatures !== false,
      ...options
    };
  }

  /**
   * Detect HTML features in markup
   * @param {string} htmlContent - HTML content to analyze
   * @param {string} filePath - File path for reporting
   * @returns {Promise<Array>} Array of detected features
   */
  async detectFeatures(htmlContent, filePath) {
    const features = [];
    this.detectedFeatures.clear();

    try {
      // Parse HTML with parse5
      const document = parse5.parse(htmlContent, {
        sourceCodeLocationInfo: true
      });

      // Walk the document tree
      this.walkDocument(document, filePath, features);

      core.debug(`Detected ${features.length} HTML features in ${filePath}`);
      return features;
    } catch (error) {
      core.warning(`Failed to parse HTML in ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Walk through the HTML document tree
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {number} depth - Current depth in tree
   */
  walkDocument(node, filePath, features, depth = 0) {
    if (!node) return;

    // Process current node
    if (node.nodeName && node.nodeName !== '#document') {
      this.processNode(node, filePath, features);
    }

    // Process child nodes
    if (node.childNodes) {
      for (const child of node.childNodes) {
        this.walkDocument(child, filePath, features, depth + 1);
      }
    }
  }

  /**
   * Process a single HTML node
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   */
  processNode(node, filePath, features) {
    if (node.nodeName === '#text' || node.nodeName === '#comment') {
      return;
    }

    const tagName = node.nodeName.toLowerCase();
    const location = this.getNodeLocation(node);

    // Detect element features
    this.detectElementFeatures(tagName, node, filePath, features, location);

    // Detect attribute features
    if (node.attrs) {
      for (const attr of node.attrs) {
        this.detectAttributeFeatures(tagName, attr, node, filePath, features, location);
      }
    }
  }

  /**
   * Detect features based on HTML elements
   * @param {string} tagName - HTML tag name
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   */
  detectElementFeatures(tagName, node, filePath, features, location) {
    // Check for element-specific features
    const featureId = getHTMLFeature(tagName);
    
    if (featureId && !this.isFeatureDetected(featureId, location)) {
      features.push({
        type: 'html-element',
        name: tagName,
        featureId: featureId,
        location: location,
        file: filePath,
        context: this.getElementContext(node)
      });
      this.markFeatureDetected(featureId, location);
    }

    // Special handling for input elements with type attribute
    if (tagName === 'input') {
      this.detectInputTypeFeatures(node, filePath, features, location);
    }

    // Special handling for link elements with rel attribute
    if (tagName === 'link') {
      this.detectLinkRelFeatures(node, filePath, features, location);
    }

    // Special handling for script elements
    if (tagName === 'script') {
      this.detectScriptFeatures(node, filePath, features, location);
    }

    // Special handling for meta elements
    if (tagName === 'meta') {
      this.detectMetaFeatures(node, filePath, features, location);
    }
  }

  /**
   * Detect features based on HTML attributes
   * @param {string} tagName - HTML tag name
   * @param {Object} attr - Attribute object
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   */
  detectAttributeFeatures(tagName, attr, node, filePath, features, location) {
    const attrName = attr.name.toLowerCase();
    const attrValue = attr.value;

    // Check for attribute-specific features
    const featureId = getHTMLFeature(attrName);
    
    if (featureId && !this.isFeatureDetected(featureId, location)) {
      features.push({
        type: 'html-attribute',
        name: attrName,
        value: attrValue,
        featureId: featureId,
        location: location,
        file: filePath,
        element: tagName,
        context: this.getAttributeContext(node, attr)
      });
      this.markFeatureDetected(featureId, location);
    }

    // Detect form validation attributes
    this.detectFormValidationAttributes(attrName, attrValue, tagName, filePath, features, location, node);

    // Detect accessibility attributes
    if (this.options.includeAriaAttributes) {
      this.detectAriaAttributes(attrName, attrValue, tagName, filePath, features, location, node);
    }

    // Detect data attributes (generally well-supported)
    if (this.options.includeDataAttributes && attrName.startsWith('data-')) {
      this.detectDataAttributes(attrName, attrValue, tagName, filePath, features, location, node);
    }

    // Detect event handler attributes
    if (attrName.startsWith('on')) {
      this.detectEventHandlerAttributes(attrName, attrValue, tagName, filePath, features, location, node);
    }
  }

  /**
   * Detect input type features
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   */
  detectInputTypeFeatures(node, filePath, features, location) {
    const typeAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'type');
    
    if (typeAttr) {
      const inputType = `input[type="${typeAttr.value}"]`;
      const featureId = getHTMLFeature(inputType);
      
      if (featureId && !this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-input-type',
          name: typeAttr.value,
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getInputTypeContext(node)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect link rel features
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   */
  detectLinkRelFeatures(node, filePath, features, location) {
    const relAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'rel');
    
    if (relAttr) {
      const relValues = relAttr.value.split(' ');
      
      for (const relValue of relValues) {
        const linkRel = `rel="${relValue}"`;
        const featureId = getHTMLFeature(linkRel);
        
        if (featureId && !this.isFeatureDetected(featureId, location)) {
          features.push({
            type: 'html-link-rel',
            name: relValue,
            featureId: featureId,
            location: location,
            file: filePath,
            context: this.getLinkContext(node)
          });
          this.markFeatureDetected(featureId, location);
        }
      }
    }
  }

  /**
   * Detect script features
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   */
  detectScriptFeatures(node, filePath, features, location) {
    const typeAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'type');
    const asyncAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'async');
    const deferAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'defer');

    // ES6 modules
    if (typeAttr && typeAttr.value === 'module') {
      const featureId = 'js-modules';
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-script-module',
          name: 'module',
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getScriptContext(node)
        });
        this.markFeatureDetected(featureId, location);
      }
    }

    // Async scripts
    if (asyncAttr) {
      const featureId = 'html-script-async';
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-script-async',
          name: 'async',
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getScriptContext(node)
        });
        this.markFeatureDetected(featureId, location);
      }
    }

    // Deferred scripts
    if (deferAttr) {
      const featureId = 'html-script-defer';
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-script-defer',
          name: 'defer',
          featureId: featureId,
          location: location,
          file: filePath,
          context: this.getScriptContext(node)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect meta tag features
   * @param {Object} node - Parse5 node
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   */
  detectMetaFeatures(node, filePath, features, location) {
    const nameAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'name');
    const httpEquivAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'http-equiv');
    const contentAttr = node.attrs?.find(attr => attr.name.toLowerCase() === 'content');

    // Viewport meta tag
    if (nameAttr && nameAttr.value === 'viewport') {
      const featureId = 'html-meta-viewport';
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-meta-viewport',
          name: 'viewport',
          featureId: featureId,
          location: location,
          file: filePath,
          content: contentAttr?.value,
          context: this.getMetaContext(node)
        });
        this.markFeatureDetected(featureId, location);
      }
    }

    // Theme color meta tag
    if (nameAttr && nameAttr.value === 'theme-color') {
      const featureId = 'html-meta-theme-color';
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-meta-theme-color',
          name: 'theme-color',
          featureId: featureId,
          location: location,
          file: filePath,
          content: contentAttr?.value,
          context: this.getMetaContext(node)
        });
        this.markFeatureDetected(featureId, location);
      }
    }

    // Content Security Policy
    if (httpEquivAttr && httpEquivAttr.value.toLowerCase() === 'content-security-policy') {
      const featureId = 'html-csp';
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-csp',
          name: 'content-security-policy',
          featureId: featureId,
          location: location,
          file: filePath,
          content: contentAttr?.value,
          context: this.getMetaContext(node)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect form validation attributes
   * @param {string} attrName - Attribute name
   * @param {string} attrValue - Attribute value
   * @param {string} tagName - Element tag name
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} node - Parse5 node
   */
  detectFormValidationAttributes(attrName, attrValue, tagName, filePath, features, location, node) {
    const validationAttrs = ['required', 'pattern', 'min', 'max', 'step', 'minlength', 'maxlength'];
    
    if (validationAttrs.includes(attrName)) {
      const featureId = getHTMLFeature(attrName) || 'html-form-validation';
      
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-form-validation',
          name: attrName,
          value: attrValue,
          featureId: featureId,
          location: location,
          file: filePath,
          element: tagName,
          context: this.getFormValidationContext(node, attrName)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect ARIA attributes
   * @param {string} attrName - Attribute name
   * @param {string} attrValue - Attribute value
   * @param {string} tagName - Element tag name
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} node - Parse5 node
   */
  detectAriaAttributes(attrName, attrValue, tagName, filePath, features, location, node) {
    if (attrName.startsWith('aria-') || attrName === 'role') {
      const featureId = 'html-aria';
      
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-aria',
          name: attrName,
          value: attrValue,
          featureId: featureId,
          location: location,
          file: filePath,
          element: tagName,
          context: this.getAriaContext(node, attrName)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
  }

  /**
   * Detect data attributes
   * @param {string} attrName - Attribute name
   * @param {string} attrValue - Attribute value
   * @param {string} tagName - Element tag name
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} node - Parse5 node
   */
  detectDataAttributes(attrName, attrValue, tagName, filePath, features, location, node) {
    const featureId = 'html-data-attributes';
    
    if (!this.isFeatureDetected(featureId, location)) {
      features.push({
        type: 'html-data-attribute',
        name: attrName,
        value: attrValue,
        featureId: featureId,
        location: location,
        file: filePath,
        element: tagName,
        context: this.getDataAttributeContext(node, attrName)
      });
      this.markFeatureDetected(featureId, location);
    }
  }

  /**
   * Detect event handler attributes
   * @param {string} attrName - Attribute name
   * @param {string} attrValue - Attribute value
   * @param {string} tagName - Element tag name
   * @param {string} filePath - File path
   * @param {Array} features - Array to collect features
   * @param {Object} location - Source location
   * @param {Object} node - Parse5 node
   */
  detectEventHandlerAttributes(attrName, attrValue, tagName, filePath, features, location, node) {
    // Most event handlers are widely supported, but some newer ones might not be
    const modernEventHandlers = ['onpointerdown', 'onpointerup', 'onpointermove', 'onpointercancel'];
    
    if (modernEventHandlers.includes(attrName)) {
      const featureId = 'html-pointer-events';
      
      if (!this.isFeatureDetected(featureId, location)) {
        features.push({
          type: 'html-event-handler',
          name: attrName,
          value: attrValue,
          featureId: featureId,
          location: location,
          file: filePath,
          element: tagName,
          context: this.getEventHandlerContext(node, attrName)
        });
        this.markFeatureDetected(featureId, location);
      }
    }
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
   * Get source location from Parse5 node
   * @param {Object} node - Parse5 node
   * @returns {Object} Location object
   */
  getNodeLocation(node) {
    const loc = node.sourceCodeLocation;
    return {
      line: loc?.startLine || 1,
      column: loc?.startCol || 1,
      endLine: loc?.endLine,
      endColumn: loc?.endCol
    };
  }

  // Context methods

  getElementContext(node) {
    return {
      tagName: node.nodeName,
      attributes: node.attrs?.map(attr => ({ name: attr.name, value: attr.value })) || [],
      hasChildren: !!(node.childNodes && node.childNodes.length > 0)
    };
  }

  getAttributeContext(node, attr) {
    return {
      element: node.nodeName,
      attribute: attr.name,
      value: attr.value,
      otherAttributes: node.attrs?.filter(a => a !== attr).map(a => a.name) || []
    };
  }

  getInputTypeContext(node) {
    const attrs = node.attrs || [];
    return {
      type: attrs.find(attr => attr.name === 'type')?.value,
      hasValidation: attrs.some(attr => ['required', 'pattern', 'min', 'max'].includes(attr.name)),
      otherAttributes: attrs.filter(attr => attr.name !== 'type').map(attr => attr.name)
    };
  }

  getLinkContext(node) {
    const attrs = node.attrs || [];
    return {
      rel: attrs.find(attr => attr.name === 'rel')?.value,
      href: attrs.find(attr => attr.name === 'href')?.value,
      type: attrs.find(attr => attr.name === 'type')?.value
    };
  }

  getScriptContext(node) {
    const attrs = node.attrs || [];
    return {
      type: attrs.find(attr => attr.name === 'type')?.value,
      src: attrs.find(attr => attr.name === 'src')?.value,
      async: attrs.some(attr => attr.name === 'async'),
      defer: attrs.some(attr => attr.name === 'defer'),
      hasInlineContent: !!(node.childNodes && node.childNodes.length > 0)
    };
  }

  getMetaContext(node) {
    const attrs = node.attrs || [];
    return {
      name: attrs.find(attr => attr.name === 'name')?.value,
      httpEquiv: attrs.find(attr => attr.name === 'http-equiv')?.value,
      content: attrs.find(attr => attr.name === 'content')?.value,
      charset: attrs.find(attr => attr.name === 'charset')?.value
    };
  }

  getFormValidationContext(node, attrName) {
    return {
      element: node.nodeName,
      validationAttribute: attrName,
      inputType: node.attrs?.find(attr => attr.name === 'type')?.value,
      hasOtherValidation: node.attrs?.some(attr => 
        ['required', 'pattern', 'min', 'max', 'step'].includes(attr.name) && attr.name !== attrName
      ) || false
    };
  }

  getAriaContext(node, attrName) {
    return {
      element: node.nodeName,
      ariaAttribute: attrName,
      role: node.attrs?.find(attr => attr.name === 'role')?.value,
      hasOtherAria: node.attrs?.some(attr => 
        (attr.name.startsWith('aria-') || attr.name === 'role') && attr.name !== attrName
      ) || false
    };
  }

  getDataAttributeContext(node, attrName) {
    return {
      element: node.nodeName,
      dataAttribute: attrName,
      dataCount: node.attrs?.filter(attr => attr.name.startsWith('data-')).length || 0
    };
  }

  getEventHandlerContext(node, attrName) {
    return {
      element: node.nodeName,
      eventHandler: attrName,
      eventType: attrName.replace('on', ''),
      hasOtherHandlers: node.attrs?.some(attr => 
        attr.name.startsWith('on') && attr.name !== attrName
      ) || false
    };
  }

  /**
   * Reset detector state
   */
  reset() {
    this.detectedFeatures.clear();
  }
}

module.exports = HTMLFeatureDetector;