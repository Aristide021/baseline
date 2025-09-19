#!/usr/bin/env node

/**
 * Phase 1: Enhanced Discovery - Automated New Mapping Suggestions
 * 
 * This script analyzes the web-features database to suggest new feature mappings
 * that could be added to our system. It identifies direct name matches and 
 * high-priority unmapped features automatically.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class MappingSuggestionEngine {
  constructor() {
    this.webFeatures = null;
    this.currentMappings = null;
    this.allMappedFeatureIds = new Set();
  }

  async initialize() {
    console.log('🔍 Initializing Enhanced Discovery Engine...\n');
    
    // Load web-features database
    this.webFeatures = await import('web-features');
    console.log(`📊 Loaded ${Object.keys(this.webFeatures.features).length} features from web-features database`);
    
    // Load current mappings
    this.currentMappings = await this.loadCurrentMappings();
    this.buildMappedFeatureSet();
    
    console.log(`📋 Current mappings: ${this.allMappedFeatureIds.size} unique feature IDs mapped`);
    console.log(`🎯 Discovery opportunity: ${Object.keys(this.webFeatures.features).length - this.allMappedFeatureIds.size} unmapped features\n`);
  }

  async loadCurrentMappings() {
    const mappingsPath = join(__dirname, '..', 'src', 'utils', 'feature-mappings.js');
    const { 
      CSS_PROPERTY_MAPPING, 
      CSS_SELECTOR_MAPPING,
      CSS_FUNCTION_MAPPING, 
      CSS_AT_RULE_MAPPING,
      JS_API_MAPPING, 
      HTML_FEATURE_MAPPING 
    } = await import(mappingsPath);

    return {
      css: {
        properties: CSS_PROPERTY_MAPPING,
        selectors: CSS_SELECTOR_MAPPING || {},
        functions: CSS_FUNCTION_MAPPING || {},
        atRules: CSS_AT_RULE_MAPPING || {}
      },
      js: JS_API_MAPPING,
      html: HTML_FEATURE_MAPPING
    };
  }

  buildMappedFeatureSet() {
    // CSS Properties  
    Object.values(this.currentMappings.css.properties).forEach(mapping => {
      if (typeof mapping === 'string') {
        this.allMappedFeatureIds.add(mapping);
      } else if (typeof mapping === 'object') {
        Object.values(mapping).forEach(id => this.allMappedFeatureIds.add(id));
      }
    });

    // CSS Selectors, Functions, At-rules
    ['selectors', 'functions', 'atRules'].forEach(category => {
      Object.values(this.currentMappings.css[category]).forEach(id => {
        if (id) this.allMappedFeatureIds.add(id);
      });
    });

    // JavaScript APIs
    Object.values(this.currentMappings.js).forEach(id => {
      if (id) this.allMappedFeatureIds.add(id);
    });

    // HTML Features
    Object.values(this.currentMappings.html).forEach(id => {
      if (id) this.allMappedFeatureIds.add(id);
    });

    // Remove null values
    this.allMappedFeatureIds.delete(null);
  }

  findDirectNameMatches() {
    console.log('🎯 Finding direct name matches...');
    
    const directMatches = {
      css: [],
      js: [],
      html: []
    };

    Object.entries(this.webFeatures.features).forEach(([featureId, feature]) => {
      // Skip if already mapped
      if (this.allMappedFeatureIds.has(featureId)) return;

      const name = feature.name.toLowerCase();
      const id = featureId.toLowerCase();

      // CSS-related features
      if (this.isCSSFeature(feature)) {
        // Direct CSS property matches
        if (id === name.replace(/[^a-z0-9-]/g, '-') || 
            id === name.replace(/\s+/g, '-') ||
            name.includes(id) ||
            id.includes(name.replace(/[^a-z0-9]/g, ''))) {
          directMatches.css.push({
            featureId,
            name: feature.name,
            suggestedMapping: id,
            confidence: this.calculateConfidence(id, name, 'css'),
            baseline: feature.baseline?.status || 'unknown',
            category: this.categorizeFeature(feature)
          });
        }
      }

      // JavaScript-related features  
      if (this.isJSFeature(feature)) {
        // API name matching
        const apiPatterns = [
          name.replace(/\s+/g, ''),
          name.replace(/[^a-zA-Z0-9]/g, ''),
          id.replace(/-/g, ''),
          id
        ];

        apiPatterns.forEach(pattern => {
          if (pattern.length > 3 && (
            pattern.toLowerCase().includes('api') ||
            pattern.toLowerCase().includes('method') ||
            this.isLikelyAPIName(pattern)
          )) {
            directMatches.js.push({
              featureId,
              name: feature.name,
              suggestedMapping: pattern,
              confidence: this.calculateConfidence(pattern, name, 'js'),
              baseline: feature.baseline?.status || 'unknown',
              category: this.categorizeFeature(feature)
            });
          }
        });
      }

      // HTML-related features
      if (this.isHTMLFeature(feature)) {
        // Element/attribute matching
        if (name.includes('<') && name.includes('>')) {
          const elementName = name.match(/<([^>]+)>/)?.[1];
          if (elementName) {
            directMatches.html.push({
              featureId,
              name: feature.name,
              suggestedMapping: elementName,
              confidence: this.calculateConfidence(elementName, name, 'html'),
              baseline: feature.baseline?.status || 'unknown',
              category: this.categorizeFeature(feature)
            });
          }
        }
      }
    });

    // Sort by confidence and baseline status
    ['css', 'js', 'html'].forEach(category => {
      directMatches[category].sort((a, b) => {
        const baselinePriority = { 'widely': 3, 'newly': 2, 'limited': 1, 'unknown': 0 };
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return (baselinePriority[b.baseline] || 0) - (baselinePriority[a.baseline] || 0);
      });
    });

    return directMatches;
  }

  findHighPriorityFeatures() {
    console.log('🏆 Finding high-priority unmapped features...');
    
    const highPriority = [];

    Object.entries(this.webFeatures.features).forEach(([featureId, feature]) => {
      // Skip if already mapped
      if (this.allMappedFeatureIds.has(featureId)) return;

      const priority = this.calculateFeaturePriority(feature);
      
      if (priority >= 70) { // High priority threshold
        highPriority.push({
          featureId,
          name: feature.name,
          priority,
          baseline: feature.baseline?.status || 'unknown',
          category: this.categorizeFeature(feature),
          reasoning: this.explainPriority(feature)
        });
      }
    });

    // Sort by priority
    highPriority.sort((a, b) => b.priority - a.priority);

    return highPriority.slice(0, 50); // Top 50 suggestions
  }

  isCSSFeature(feature) {
    const name = feature.name.toLowerCase();
    const categories = feature.category || [];
    
    return name.includes('css') ||
           name.includes('property') ||
           name.includes('selector') ||
           name.includes('rule') ||
           name.includes('function') ||
           categories.some(cat => cat.toLowerCase().includes('css')) ||
           (Array.isArray(feature.spec) && feature.spec.some(spec => spec.toLowerCase().includes('css')));
  }

  isJSFeature(feature) {
    const name = feature.name.toLowerCase();
    const categories = feature.category || [];
    
    return name.includes('javascript') ||
           name.includes('api') ||
           name.includes('method') ||
           name.includes('object') ||
           name.includes('array') ||
           name.includes('string') ||
           name.includes('promise') ||
           categories.some(cat => cat.toLowerCase().includes('js')) ||
           this.isLikelyAPIName(feature.name);
  }

  isHTMLFeature(feature) {
    const name = feature.name.toLowerCase();
    const categories = feature.category || [];
    
    return name.includes('<') ||
           name.includes('element') ||
           name.includes('attribute') ||
           name.includes('html') ||
           categories.some(cat => cat.toLowerCase().includes('html'));
  }

  isLikelyAPIName(name) {
    const apiKeywords = [
      'observer', 'worker', 'request', 'response', 'event', 'stream',
      'audio', 'video', 'canvas', 'crypto', 'storage', 'history',
      'location', 'navigator', 'document', 'window', 'element'
    ];
    
    return apiKeywords.some(keyword => name.toLowerCase().includes(keyword));
  }

  calculateConfidence(suggested, actual, type) {
    let confidence = 0;
    
    // Exact match = highest confidence
    if (suggested.toLowerCase() === actual.toLowerCase()) return 95;
    
    // High similarity
    if (suggested.toLowerCase().includes(actual.toLowerCase()) ||
        actual.toLowerCase().includes(suggested.toLowerCase())) {
      confidence += 80;
    }
    
    // Word overlap
    const suggestedWords = suggested.toLowerCase().split(/[^a-z0-9]/);
    const actualWords = actual.toLowerCase().split(/[^a-z0-9]/);
    const overlap = suggestedWords.filter(word => actualWords.includes(word)).length;
    confidence += (overlap / Math.max(suggestedWords.length, actualWords.length)) * 60;
    
    // Type-specific bonuses
    if (type === 'css' && (suggested.includes('-') || actual.includes('-'))) confidence += 10;
    if (type === 'html' && (suggested.match(/^[a-z]+$/) && actual.includes('<'))) confidence += 15;
    if (type === 'js' && this.isLikelyAPIName(suggested)) confidence += 20;
    
    return Math.min(Math.round(confidence), 100);
  }

  calculateFeaturePriority(feature) {
    let priority = 0;
    const name = feature.name.toLowerCase();
    
    // Baseline status priority
    const baseline = feature.baseline?.status;
    if (baseline === 'widely') priority += 40;
    else if (baseline === 'newly') priority += 30;
    else if (baseline === 'limited') priority += 10;
    
    // Category priority
    if (this.isCSSFeature(feature)) priority += 25;
    if (this.isJSFeature(feature)) priority += 20;
    if (this.isHTMLFeature(feature)) priority += 15;
    
    // Feature importance keywords
    const importantKeywords = [
      'grid', 'flex', 'container', 'query', 'selector', 'function',
      'animation', 'transform', 'color', 'font', 'border', 'margin',
      'padding', 'fetch', 'promise', 'async', 'event', 'observer',
      'element', 'attribute', 'form', 'input', 'media'
    ];
    
    const keywordMatches = importantKeywords.filter(keyword => 
      name.includes(keyword)
    ).length;
    priority += keywordMatches * 5;
    
    // Modern feature indicators
    if (name.includes('modern') || name.includes('new') || name.includes('latest')) {
      priority += 15;
    }
    
    // Commonly used features
    if (name.includes('layout') || name.includes('responsive') || name.includes('mobile')) {
      priority += 10;
    }
    
    return Math.min(priority, 100);
  }

  explainPriority(feature) {
    const reasons = [];
    const name = feature.name.toLowerCase();
    const baseline = feature.baseline?.status;
    
    if (baseline === 'widely') reasons.push('Widely supported in Baseline');
    else if (baseline === 'newly') reasons.push('Newly supported in Baseline');
    
    if (this.isCSSFeature(feature)) reasons.push('CSS feature - high detection value');
    if (this.isJSFeature(feature)) reasons.push('JavaScript API - commonly used');
    if (this.isHTMLFeature(feature)) reasons.push('HTML feature - semantic importance');
    
    if (name.includes('grid') || name.includes('flex')) reasons.push('Modern layout feature');
    if (name.includes('container') || name.includes('query')) reasons.push('Responsive design feature');
    if (name.includes('selector')) reasons.push('CSS selector - developer productivity');
    if (name.includes('animation') || name.includes('transform')) reasons.push('Visual effects feature');
    
    return reasons.join(', ');
  }

  categorizeFeature(feature) {
    const name = feature.name.toLowerCase();
    
    if (name.includes('grid') || name.includes('flex') || name.includes('layout')) return 'Layout';
    if (name.includes('animation') || name.includes('transform') || name.includes('transition')) return 'Animation';
    if (name.includes('color') || name.includes('gradient') || name.includes('filter')) return 'Visual';
    if (name.includes('font') || name.includes('text') || name.includes('typography')) return 'Typography';
    if (name.includes('selector') || name.includes('pseudo')) return 'Selectors';
    if (name.includes('function') || name.includes('calc') || name.includes('math')) return 'Functions';
    if (name.includes('query') || name.includes('media') || name.includes('responsive')) return 'Responsive';
    if (name.includes('api') || name.includes('method')) return 'JavaScript API';
    if (name.includes('element') || name.includes('attribute')) return 'HTML';
    if (name.includes('form') || name.includes('input')) return 'Forms';
    
    return 'Other';
  }

  generateReport(directMatches, highPriority) {
    console.log('\n' + '='.repeat(100));
    console.log('📊 ENHANCED DISCOVERY REPORT - NEW MAPPING SUGGESTIONS');
    console.log('='.repeat(100));
    
    // Executive Summary
    const totalSuggestions = directMatches.css.length + directMatches.js.length + 
                           directMatches.html.length + highPriority.length;
    
    console.log(`\n🎯 EXECUTIVE SUMMARY:`);
    console.log(`   Total Suggestions: ${totalSuggestions}`);
    console.log(`   Direct Matches: ${directMatches.css.length + directMatches.js.length + directMatches.html.length}`);
    console.log(`   High Priority: ${highPriority.length}`);
    
    // Direct Matches Report
    console.log(`\n🎯 DIRECT NAME MATCHES (High Confidence):`);
    
    ['css', 'js', 'html'].forEach(category => {
      if (directMatches[category].length > 0) {
        console.log(`\n   📋 ${category.toUpperCase()} Direct Matches (${directMatches[category].length}):`);
        directMatches[category].slice(0, 10).forEach((match, i) => {
          console.log(`      ${i + 1}. ${match.featureId} -> "${match.name}"`);
          console.log(`         Confidence: ${match.confidence}% | Baseline: ${match.baseline} | Category: ${match.category}`);
        });
        if (directMatches[category].length > 10) {
          console.log(`      ... and ${directMatches[category].length - 10} more`);
        }
      }
    });
    
    // High Priority Report
    console.log(`\n🏆 HIGH PRIORITY UNMAPPED FEATURES (Top 20):`);
    highPriority.slice(0, 20).forEach((feature, i) => {
      console.log(`   ${i + 1}. ${feature.featureId} - "${feature.name}"`);
      console.log(`      Priority: ${feature.priority} | Baseline: ${feature.baseline} | Category: ${feature.category}`);
      console.log(`      Reasoning: ${feature.reasoning}`);
      console.log('');
    });
    
    // Implementation Recommendations
    console.log(`\n🛠️ IMPLEMENTATION RECOMMENDATIONS:`);
    console.log(`   1. Start with Direct Matches (confidence >80%)`);
    console.log(`   2. Focus on 'widely' baseline features first`);
    console.log(`   3. Prioritize CSS Layout and JavaScript API features`);
    console.log(`   4. Validate suggestions against real codebases`);
    
    console.log(`\n📈 IMPACT ESTIMATE:`);
    console.log(`   Potential new mappings: ${Math.min(totalSuggestions, 100)}`);
    console.log(`   Current mappings: ${this.allMappedFeatureIds.size}`);
    console.log(`   Potential increase: ${Math.round((Math.min(totalSuggestions, 100) / this.allMappedFeatureIds.size) * 100)}%`);
    
    console.log('\n' + '='.repeat(100));
    
    return { directMatches, highPriority, totalSuggestions };
  }

  async run() {
    try {
      await this.initialize();
      
      const directMatches = this.findDirectNameMatches();
      const highPriority = this.findHighPriorityFeatures();
      
      const report = this.generateReport(directMatches, highPriority);
      
      console.log(`\n✅ Enhanced Discovery complete!`);
      console.log(`📄 Found ${report.totalSuggestions} new mapping suggestions`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Enhanced Discovery failed:', error.message);
      throw error;
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new MappingSuggestionEngine();
  engine.run()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

export default MappingSuggestionEngine;