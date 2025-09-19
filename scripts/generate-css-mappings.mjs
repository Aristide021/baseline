#!/usr/bin/env node

/**
 * Generate CSS feature mappings for integration into feature-mappings.js
 * Based on the CSS feature research results
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class CSSMappingGenerator {
  constructor() {
    this.reportPath = join(__dirname, '..', 'css-feature-research-report.json');
    this.report = null;
    this.cssPropertyMappings = {};
    this.cssSelectorMappings = {};
    this.cssFunctionMappings = {};
    this.cssAtRuleMappings = {};
  }

  loadReport() {
    try {
      const reportData = readFileSync(this.reportPath, 'utf8');
      this.report = JSON.parse(reportData);
      console.log('✅ Loaded CSS feature research report');
    } catch (error) {
      console.error('❌ Failed to load report:', error.message);
      throw error;
    }
  }

  /**
   * Generate CSS property mappings based on feature names and IDs
   */
  generatePropertyMappings() {
    console.log('🎨 Generating CSS property mappings...');
    
    const propertyPatterns = {
      // Layout Properties
      'display': {
        'grid': 'grid',
        'flex': 'flexbox',
        'contents': 'display-contents'
      },
      'grid-template-columns': 'grid',
      'grid-template-rows': 'grid',
      'grid-template-areas': 'grid',
      'grid-column': 'grid',
      'grid-row': 'grid',
      'grid-area': 'grid',
      'grid-gap': 'flexbox-gap',
      'gap': 'flexbox-gap',
      'column-gap': 'flexbox-gap',
      'row-gap': 'flexbox-gap',
      
      // Flexbox
      'flex': 'flexbox',
      'flex-direction': 'flexbox',
      'flex-wrap': 'flexbox',
      'flex-flow': 'flexbox',
      'justify-content': 'flexbox',
      'align-items': 'flexbox',
      'align-content': 'flexbox',
      'align-self': 'flexbox',
      'order': 'flexbox',
      'flex-grow': 'flexbox',
      'flex-shrink': 'flexbox',
      'flex-basis': 'flexbox',
      
      // Container Queries
      'container-type': 'container-queries',
      'container-name': 'container-queries',
      'container': 'container-queries',
      
      // Aspect Ratio
      'aspect-ratio': 'aspect-ratio',
      
      // Font Features
      'font-variant': 'font-variant',
      'font-variant-caps': 'font-variant-caps',
      'font-variant-east-asian': 'font-variant-east-asian',
      'font-variant-ligatures': 'font-variant-ligatures',
      'font-variant-numeric': 'font-variant-numeric',
      'font-variation-settings': 'font-variation-settings',
      'font-feature-settings': 'font-feature-settings',
      
      // Logical Properties
      'margin-inline-start': 'logical-properties',
      'margin-inline-end': 'logical-properties',
      'margin-block-start': 'logical-properties',
      'margin-block-end': 'logical-properties',
      'padding-inline-start': 'logical-properties',
      'padding-inline-end': 'logical-properties',
      'padding-block-start': 'logical-properties',
      'padding-block-end': 'logical-properties',
      'border-inline-start': 'logical-properties',
      'border-inline-end': 'logical-properties',
      'border-block-start': 'logical-properties',
      'border-block-end': 'logical-properties',
      'inline-size': 'logical-properties',
      'block-size': 'logical-properties',
      'min-inline-size': 'logical-properties',
      'min-block-size': 'logical-properties',
      'max-inline-size': 'logical-properties',
      'max-block-size': 'logical-properties',
      
      // Scroll and Interaction
      'scroll-behavior': 'scroll-behavior',
      'scroll-snap-type': 'scroll-snap',
      'scroll-snap-align': 'scroll-snap',
      'scroll-snap-stop': 'scroll-snap',
      'overscroll-behavior': 'overscroll-behavior',
      'overscroll-behavior-x': 'overscroll-behavior',
      'overscroll-behavior-y': 'overscroll-behavior',
      
      // Color and Appearance
      'accent-color': 'accent-color',
      'color-scheme': 'color-scheme',
      'forced-color-adjust': 'forced-colors',
      
      // Effects
      'backdrop-filter': 'backdrop-filter',
      
      // Overflow
      'overflow': {
        'clip': 'overflow-clip'
      },
      
      // Text
      'text-align-last': 'text-align-last',
      
      // Transform
      'rotate': 'individual-transforms',
      'scale': 'individual-transforms',
      'translate': 'individual-transforms',
      
      // Animation and Transitions (existing)
      'animation': 'animations-css',
      'animation-name': 'animations-css',
      'animation-duration': 'animations-css',
      'animation-timing-function': 'animations-css',
      'animation-delay': 'animations-css',
      'animation-iteration-count': 'animations-css',
      'animation-direction': 'animations-css',
      'animation-fill-mode': 'animations-css',
      'animation-play-state': 'animations-css',
      'transition': 'transitions',
      'transition-property': 'transitions',
      'transition-duration': 'transitions',
      'transition-timing-function': 'transitions',
      'transition-delay': 'transitions',
      'transform': 'transforms2d',
      'transform-origin': 'transforms2d',
      
      // Existing properties to maintain
      'box-sizing': 'box-sizing',
      'position': 'absolute-positioning',
      'color': 'currentcolor',
      'opacity': 'opacity'
    };

    this.cssPropertyMappings = propertyPatterns;
    console.log(`✅ Generated ${Object.keys(propertyPatterns).length} CSS property mappings`);
  }

  /**
   * Generate CSS selector mappings
   */
  generateSelectorMappings() {
    console.log('🔍 Generating CSS selector mappings...');
    
    const selectorPatterns = {
      ':is': 'is',
      ':where': 'where', 
      ':has': 'has',
      ':not': 'not-selector',
      ':nth-child': 'nth-child',
      ':nth-last-child': 'nth-child',
      ':nth-of-type': 'nth-child',
      ':nth-last-of-type': 'nth-child',
      ':first-child': 'first-child',
      ':last-child': 'last-child',
      ':only-child': 'only-child',
      ':first-of-type': 'first-of-type',
      ':last-of-type': 'last-of-type',
      ':only-of-type': 'only-of-type',
      ':target': 'target-pseudo-class',
      ':focus': 'focus-pseudo-class',
      ':focus-visible': 'focus-visible',
      ':focus-within': 'focus-within',
      ':hover': 'hover-pseudo-class',
      ':active': 'active-pseudo-class',
      ':visited': 'visited-pseudo-class',
      ':checked': 'checked-pseudo-class',
      ':disabled': 'disabled-pseudo-class',
      ':enabled': 'enabled-pseudo-class',
      ':required': 'required-pseudo-class',
      ':optional': 'optional-pseudo-class',
      ':valid': 'valid-pseudo-class',
      ':invalid': 'invalid-pseudo-class',
      ':in-range': 'in-range-pseudo-class',
      ':out-of-range': 'out-of-range-pseudo-class',
      ':read-only': 'read-only-pseudo-class',
      ':read-write': 'read-write-pseudo-class',
      ':indeterminate': 'indeterminate',
      '::before': 'before-after-pseudo-elements',
      '::after': 'before-after-pseudo-elements',
      '::first-line': 'first-line-first-letter',
      '::first-letter': 'first-line-first-letter',
      '::selection': 'selection-pseudo-element',
      '::backdrop': 'backdrop-pseudo-element',
      '::marker': 'marker-pseudo-element',
      '::placeholder': 'placeholder-pseudo-element'
    };

    this.cssSelectorMappings = selectorPatterns;
    console.log(`✅ Generated ${Object.keys(selectorPatterns).length} CSS selector mappings`);
  }

  /**
   * Generate CSS function mappings
   */
  generateFunctionMappings() {
    console.log('🔧 Generating CSS function mappings...');
    
    const functionPatterns = {
      'calc': 'calc',
      'min': 'min-max-clamp',
      'max': 'min-max-clamp', 
      'clamp': 'min-max-clamp',
      'var': 'custom-properties',
      'env': 'safe-area-inset',
      'rgb': 'rgb-function',
      'rgba': 'rgba-function',
      'hsl': 'hsl-function',
      'hsla': 'hsla-function',
      'url': 'url-function',
      'attr': 'attr-function',
      'counter': 'counter-function',
      'linear-gradient': 'linear-gradient',
      'radial-gradient': 'radial-gradient',
      'conic-gradient': 'conic-gradient',
      'repeating-linear-gradient': 'repeating-gradients',
      'repeating-radial-gradient': 'repeating-gradients',
      'repeating-conic-gradient': 'repeating-gradients',
      'fit-content': 'fit-content',
      'minmax': 'minmax',
      'repeat': 'repeat-function'
    };

    this.cssFunctionMappings = functionPatterns;
    console.log(`✅ Generated ${Object.keys(functionPatterns).length} CSS function mappings`);
  }

  /**
   * Generate CSS at-rule mappings
   */
  generateAtRuleMappings() {
    console.log('📋 Generating CSS at-rule mappings...');
    
    const atRulePatterns = {
      '@media': 'media-queries',
      '@supports': 'supports',
      '@import': 'import-css',
      '@charset': 'charset',
      '@namespace': 'namespace',
      '@keyframes': 'keyframes',
      '@page': 'page-css',
      '@font-face': 'font-face',
      '@layer': 'cascade-layers',
      '@container': 'container-queries',
      '@property': 'custom-properties',
      '@counter-style': 'counter-style'
    };

    this.cssAtRuleMappings = atRulePatterns;
    console.log(`✅ Generated ${Object.keys(atRulePatterns).length} CSS at-rule mappings`);
  }

  /**
   * Generate JavaScript code for the mappings
   */
  generateMappingCode() {
    console.log('💾 Generating mapping code...');
    
    const code = `
// Enhanced CSS Property Mappings (Generated from CSS Feature Research)
const ENHANCED_CSS_PROPERTY_MAPPING = ${JSON.stringify(this.cssPropertyMappings, null, 2)};

// CSS Selector Mappings
const CSS_SELECTOR_MAPPING = ${JSON.stringify(this.cssSelectorMappings, null, 2)};

// CSS Function Mappings  
const CSS_FUNCTION_MAPPING = ${JSON.stringify(this.cssFunctionMappings, null, 2)};

// CSS At-Rule Mappings
const CSS_AT_RULE_MAPPING = ${JSON.stringify(this.cssAtRuleMappings, null, 2)};

/**
 * Enhanced CSS selector feature detection
 * @param {string} selector - CSS selector
 * @returns {string|null} Feature ID or null if not mapped
 */
function getCSSSelectorFeature(selector) {
  // Clean selector and check for matches
  const cleanSelector = selector.trim();
  return CSS_SELECTOR_MAPPING[cleanSelector] || null;
}

/**
 * Enhanced CSS function feature detection
 * @param {string} functionName - CSS function name
 * @returns {string|null} Feature ID or null if not mapped
 */
function getCSSFunctionFeature(functionName) {
  return CSS_FUNCTION_MAPPING[functionName] || null;
}

/**
 * Enhanced CSS at-rule feature detection
 * @param {string} atRule - CSS at-rule name (with @)
 * @returns {string|null} Feature ID or null if not mapped
 */
function getCSSAtRuleFeature(atRule) {
  return CSS_AT_RULE_MAPPING[atRule] || null;
}

// Export the enhanced mappings and functions
module.exports = {
  ENHANCED_CSS_PROPERTY_MAPPING,
  CSS_SELECTOR_MAPPING,
  CSS_FUNCTION_MAPPING,
  CSS_AT_RULE_MAPPING,
  getCSSSelectorFeature,
  getCSSFunctionFeature,
  getCSSAtRuleFeature
};`;

    return code;
  }

  /**
   * Generate prioritized feature list for immediate implementation
   */
  generatePriorityReport() {
    console.log('📊 Generating priority implementation report...');
    
    const topFeatures = this.report.recommendations.immediate;
    const categories = {};
    
    // Group features by category
    topFeatures.forEach(feature => {
      if (!categories[feature.category]) {
        categories[feature.category] = [];
      }
      categories[feature.category].push(feature);
    });

    const report = {
      summary: {
        totalRecommended: topFeatures.length,
        categoriesCount: Object.keys(categories).length,
        averageScore: topFeatures.reduce((sum, f) => sum + f.score, 0) / topFeatures.length
      },
      categories,
      implementationOrder: topFeatures.map((feature, index) => ({
        priority: index + 1,
        id: feature.id,
        name: feature.name,
        category: feature.category,
        score: feature.score,
        baseline: feature.baseline,
        reasoning: feature.reasoning
      })),
      mappingGaps: {
        needsPropertyMapping: topFeatures.filter(f => f.category === 'Layout' || f.category === 'Functions'),
        needsSelectorMapping: topFeatures.filter(f => f.category === 'Selectors'),
        needsFunctionMapping: topFeatures.filter(f => f.category === 'Functions'),
        needsAtRuleMapping: topFeatures.filter(f => f.category === 'At-Rules')
      }
    };

    return report;
  }

  /**
   * Run the complete mapping generation workflow
   */
  async run() {
    console.log('🚀 Starting CSS Mapping Generation\n');
    
    try {
      // Load the research report
      this.loadReport();
      
      // Generate all mapping types
      this.generatePropertyMappings();
      this.generateSelectorMappings(); 
      this.generateFunctionMappings();
      this.generateAtRuleMappings();
      
      // Generate code and reports
      const mappingCode = this.generateMappingCode();
      const priorityReport = this.generatePriorityReport();
      
      // Save mapping code
      const mappingPath = join(__dirname, '..', 'enhanced-css-mappings.js');
      writeFileSync(mappingPath, mappingCode);
      
      // Save priority report
      const priorityPath = join(__dirname, '..', 'css-implementation-priority.json');
      writeFileSync(priorityPath, JSON.stringify(priorityReport, null, 2));
      
      console.log('\n' + '='.repeat(80));
      console.log('🎯 CSS MAPPING GENERATION COMPLETE');
      console.log('='.repeat(80));
      console.log(`\n📊 SUMMARY:`);
      console.log(`   CSS Properties: ${Object.keys(this.cssPropertyMappings).length}`);
      console.log(`   CSS Selectors: ${Object.keys(this.cssSelectorMappings).length}`);
      console.log(`   CSS Functions: ${Object.keys(this.cssFunctionMappings).length}`);
      console.log(`   CSS At-Rules: ${Object.keys(this.cssAtRuleMappings).length}`);
      console.log(`   Total Mappings: ${Object.keys(this.cssPropertyMappings).length + Object.keys(this.cssSelectorMappings).length + Object.keys(this.cssFunctionMappings).length + Object.keys(this.cssAtRuleMappings).length}`);
      
      console.log(`\n📁 FILES GENERATED:`);
      console.log(`   enhanced-css-mappings.js - Enhanced mapping functions`);
      console.log(`   css-implementation-priority.json - Implementation priority guide`);
      
      console.log(`\n🏆 TOP 10 PRIORITY FEATURES TO IMPLEMENT:`);
      priorityReport.implementationOrder.slice(0, 10).forEach((feature, i) => {
        console.log(`   ${i + 1}. ${feature.id} [${feature.category}] (score: ${feature.score})`);
      });
      
      console.log(`\n💡 NEXT STEPS:`);
      console.log(`   1. Review the generated mappings in enhanced-css-mappings.js`);
      console.log(`   2. Integrate the priority features into your existing feature-mappings.js`);
      console.log(`   3. Focus on high-scoring Layout, Functions, and Selectors features first`);
      console.log(`   4. Test the new mappings with your existing codebase`);
      console.log('='.repeat(80));
      
      return {
        mappingCode,
        priorityReport,
        totalMappings: Object.keys(this.cssPropertyMappings).length + Object.keys(this.cssSelectorMappings).length + Object.keys(this.cssFunctionMappings).length + Object.keys(this.cssAtRuleMappings).length
      };
      
    } catch (error) {
      console.error('❌ Mapping generation failed:', error.message);
      throw error;
    }
  }
}

// Run the mapping generation if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new CSSMappingGenerator();
  generator.run()
    .then(() => {
      console.log('\n✅ CSS mapping generation completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ CSS mapping generation failed:', error.message);
      process.exit(1);
    });
}

export default CSSMappingGenerator;