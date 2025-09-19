#!/usr/bin/env node

/**
 * Enforcement Strategy Analyzer
 * 
 * Analyzes whether we should enforce baseline compliance per-feature 
 * or in yearly batches, based on webstatus.dev data patterns
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class EnforcementStrategyAnalyzer {
  constructor() {
    this.webFeatures = null;
    this.mappedFeatures = new Set();
  }

  async initialize() {
    console.log('📊 Enforcement Strategy Analyzer');
    console.log('==================================');
    console.log('Analyzing per-feature vs yearly batch enforcement strategies\n');
    
    this.webFeatures = await import('web-features');
    console.log(`📊 Loaded ${Object.keys(this.webFeatures.features).length} features from web-features database`);
    
    // Load our current mappings
    await this.loadCurrentMappings();
    console.log(`🎯 Analyzing ${this.mappedFeatures.size} mapped features\n`);
  }

  async loadCurrentMappings() {
    const { 
      CSS_PROPERTY_MAPPING, 
      CSS_SELECTOR_MAPPING,
      CSS_FUNCTION_MAPPING,
      CSS_AT_RULE_MAPPING,
      JS_API_MAPPING, 
      HTML_FEATURE_MAPPING 
    } = await import('../src/utils/feature-mappings.js');

    // Extract all mapped feature IDs
    Object.values(CSS_PROPERTY_MAPPING).forEach(mapping => {
      if (typeof mapping === 'string') this.mappedFeatures.add(mapping);
      else if (typeof mapping === 'object') {
        Object.values(mapping).forEach(id => this.mappedFeatures.add(id));
      }
    });
    
    Object.values(CSS_SELECTOR_MAPPING || {}).forEach(id => this.mappedFeatures.add(id));
    Object.values(CSS_FUNCTION_MAPPING || {}).forEach(id => this.mappedFeatures.add(id));
    Object.values(CSS_AT_RULE_MAPPING || {}).forEach(id => this.mappedFeatures.add(id));
    Object.values(JS_API_MAPPING).forEach(id => id && this.mappedFeatures.add(id));
    Object.values(HTML_FEATURE_MAPPING).forEach(id => this.mappedFeatures.add(id));
    
    this.mappedFeatures.delete(null);
  }

  analyzeByYear() {
    console.log('📅 YEARLY BASELINE ANALYSIS');
    console.log('=============================');
    
    const yearlyBreakdown = {};
    const noDateFeatures = [];
    
    this.mappedFeatures.forEach(featureId => {
      const feature = this.webFeatures.features[featureId];
      if (feature?.baseline?.low_date) {
        const year = new Date(feature.baseline.low_date).getFullYear();
        if (!yearlyBreakdown[year]) {
          yearlyBreakdown[year] = { widely: 0, newly: 0, limited: 0, count: 0, features: [] };
        }
        yearlyBreakdown[year][feature.baseline.status] += 1;
        yearlyBreakdown[year].count += 1;
        yearlyBreakdown[year].features.push({
          id: featureId,
          name: feature.name,
          status: feature.baseline.status
        });
      } else {
        noDateFeatures.push(featureId);
      }
    });

    // Sort years
    const sortedYears = Object.keys(yearlyBreakdown).sort((a, b) => b - a);
    
    console.log('📊 MAPPED FEATURES BY BASELINE YEAR:');
    sortedYears.forEach(year => {
      const data = yearlyBreakdown[year];
      console.log(`\n   ${year}: ${data.count} features`);
      console.log(`   ├── Widely supported: ${data.widely}`);
      console.log(`   ├── Newly supported: ${data.newly}`);
      console.log(`   └── Limited support: ${data.limited}`);
      
      if (data.count <= 5) {
        console.log('   Features:');
        data.features.forEach(f => {
          console.log(`   ├── ${f.id} - "${f.name}" (${f.status})`);
        });
      }
    });
    
    if (noDateFeatures.length > 0) {
      console.log(`\n   Unknown dates: ${noDateFeatures.length} features`);
      console.log(`   (These would need individual assessment)`);
    }
    
    return { yearlyBreakdown: yearlyBreakdown, sortedYears, noDateFeatures };
  }

  analyzeInteroperabilityPatterns() {
    console.log('\n🌐 INTEROPERABILITY PATTERN ANALYSIS');
    console.log('=====================================');
    
    // Identify features that appear in "Top Interop Issues" categories
    const topCSSInteropFeatures = [
      'anchor-positioning', 'container-queries', 'has', 'nesting', 
      'view-transitions', 'subgrid', 'grid', 'scrollbar-gutter',
      'scrollbar-width', 'scrollbar-color', 'scroll-driven-animations', 'scope'
    ];
    
    const topHTMLInteropFeatures = [
      'popover', 'anchor-positioning', 'cross-document-view-transitions', 
      'dialog', 'datalist', 'customized-built-in-elements', 'file-system-access',
      'scroll-driven-animations', 'notifications', 'web-bluetooth'
    ];
    
    const allInteropFeatures = [...new Set([...topCSSInteropFeatures, ...topHTMLInteropFeatures])];
    
    const ourInteropCoverage = allInteropFeatures.filter(featureId => 
      this.mappedFeatures.has(featureId)
    );
    
    console.log(`🎯 TOP INTEROP FEATURES ANALYSIS:`);
    console.log(`   Total top interop features: ${allInteropFeatures.length}`);
    console.log(`   Covered by our mappings: ${ourInteropCoverage.length}`);
    console.log(`   Coverage percentage: ${Math.round((ourInteropCoverage.length / allInteropFeatures.length) * 100)}%`);
    
    console.log(`\n✅ COVERED INTEROP FEATURES:`);
    ourInteropCoverage.forEach(featureId => {
      const feature = this.webFeatures.features[featureId];
      const status = feature?.baseline?.status || 'unknown';
      const year = feature?.baseline?.low_date ? new Date(feature.baseline.low_date).getFullYear() : 'unknown';
      console.log(`   • ${featureId} - "${feature?.name || 'Unknown'}" (${status}, ${year})`);
    });
    
    const missingInteropFeatures = allInteropFeatures.filter(featureId => 
      !this.mappedFeatures.has(featureId)
    );
    
    if (missingInteropFeatures.length > 0) {
      console.log(`\n❌ MISSING INTEROP FEATURES (High Priority for Addition):`);
      missingInteropFeatures.forEach(featureId => {
        const feature = this.webFeatures.features[featureId];
        const status = feature?.baseline?.status || 'unknown';
        console.log(`   • ${featureId} - "${feature?.name || 'Unknown'}" (${status})`);
      });
    }
    
    return { ourInteropCoverage, missingInteropFeatures, allInteropFeatures };
  }

  analyzeEnforcementStrategies() {
    console.log('\n⚖️ ENFORCEMENT STRATEGY COMPARISON');
    console.log('===================================');
    
    // Strategy 1: Per-Feature Enforcement (Current)
    console.log('🎯 STRATEGY 1: Per-Feature Enforcement (Current)');
    console.log('   Pros:');
    console.log('   ├── Granular control - each feature evaluated individually');
    console.log('   ├── Immediate feedback - violations caught as soon as code is written');
    console.log('   ├── Flexible thresholds - different baseline levels per feature');
    console.log('   └── Precise remediation - developers know exactly which feature to fix');
    console.log('   Cons:');
    console.log('   ├── Potential noise - many small violations');
    console.log('   ├── Complex configuration - 282 features to manage');
    console.log('   └── Overwhelming for large codebases with many features');
    
    // Strategy 2: Yearly Batch Enforcement
    console.log('\n📅 STRATEGY 2: Yearly Batch Enforcement');
    console.log('   Pros:');
    console.log('   ├── Clear milestones - "Must support all Baseline 2023 features"');
    console.log('   ├── Predictable - easy to communicate compliance goals');
    console.log('   ├── Manageable scope - one year of features at a time');
    console.log('   └── Business-aligned - matches industry adoption patterns');
    console.log('   Cons:');
    console.log('   ├── Less granular - might miss important individual features');
    console.log('   ├── Delayed feedback - violations only caught at year boundaries');
    console.log('   └── All-or-nothing - hard to make exceptions');
    
    // Strategy 3: Hybrid Approach
    console.log('\n🔀 STRATEGY 3: Hybrid Approach (Recommended)');
    console.log('   Implementation:');
    console.log('   ├── Yearly baselines as default compliance levels');
    console.log('   ├── Per-feature overrides for critical interop issues');
    console.log('   ├── Progressive enforcement - newer years are warnings, older years are errors');
    console.log('   └── Contextual thresholds - stricter for prod, lenient for dev');
    
    return this.generateHybridStrategy();
  }

  generateHybridStrategy() {
    const yearlyData = this.analyzeByYear();
    
    console.log('\n🎛️ HYBRID STRATEGY IMPLEMENTATION');
    console.log('==================================');
    
    const currentYear = new Date().getFullYear();
    const strategyLevels = [];
    
    yearlyData.sortedYears.forEach(year => {
      const yearNum = parseInt(year);
      const data = yearlyData.yearlyBreakdown[year];
      const age = currentYear - yearNum;
      
      let enforcementLevel, reasoning;
      
      if (age >= 3) {
        enforcementLevel = 'error';
        reasoning = 'Mature baseline - should be widely adopted';
      } else if (age >= 1) {
        enforcementLevel = 'warn';
        reasoning = 'Establishing baseline - warn but allow';
      } else {
        enforcementLevel = 'info';
        reasoning = 'New baseline - informational only';
      }
      
      strategyLevels.push({
        year: yearNum,
        features: data.count,
        enforcement: enforcementLevel,
        reasoning
      });
      
      console.log(`   ${year} (${data.count} features): ${enforcementLevel.toUpperCase()}`);
      console.log(`   └── ${reasoning}`);
    });
    
    return strategyLevels;
  }

  generateConfigurationExample() {
    console.log('\n⚙️ EXAMPLE CONFIGURATION');
    console.log('=========================');
    
    const config = {
      "enforcement": "hybrid",
      "yearly_baselines": {
        "2022": "error",
        "2023": "warn", 
        "2024": "info",
        "2025": "info"
      },
      "feature_overrides": {
        "container-queries": "warn",
        "has": "warn",
        "anchor-positioning": "info"
      },
      "interop_priority": true,
      "context_sensitive": {
        "production": "strict",
        "development": "lenient",
        "testing": "medium"
      }
    };
    
    console.log('```json');
    console.log(JSON.stringify(config, null, 2));
    console.log('```');
    
    console.log('\nThis configuration would:');
    console.log('├── Enforce 2022 baseline features as errors');
    console.log('├── Warn about 2023 baseline features');  
    console.log('├── Show info for 2024+ features');
    console.log('├── Override specific interop-critical features');
    console.log('└── Adjust strictness based on environment');
  }

  generateRecommendations() {
    console.log('\n💡 STRATEGIC RECOMMENDATIONS');
    console.log('=============================');
    
    console.log('🎯 RECOMMENDED APPROACH: Enhanced Hybrid Strategy');
    console.log('\n1. 📅 YEARLY BASELINE DEFAULTS:');
    console.log('   ├── Features 3+ years old: ERROR level enforcement');
    console.log('   ├── Features 1-2 years old: WARNING level enforcement');
    console.log('   ├── Features <1 year old: INFO level enforcement');
    console.log('   └── Automatically adjust levels as years pass');
    
    console.log('\n2. 🌐 INTEROP PRIORITY BOOST:');
    console.log('   ├── Upgrade enforcement for "Top Interop Issues"');
    console.log('   ├── Special handling for high-impact features');
    console.log('   └── Community-driven priority adjustments');
    
    console.log('\n3. 🔧 CONTEXTUAL ENFORCEMENT:');
    console.log('   ├── Stricter in production environments');
    console.log('   ├── More lenient in development/feature branches');
    console.log('   └── Configurable per-project preferences');
    
    console.log('\n4. 📊 PROGRESSIVE ROLLOUT:');
    console.log('   ├── Start with current per-feature approach');
    console.log('   ├── Add yearly baseline groupings as opt-in');
    console.log('   ├── Migrate to hybrid as default');
    console.log('   └── Monitor adoption and adjust');
    
    console.log('\n🚀 IMPLEMENTATION PRIORITY:');
    console.log('   Phase 1 (Immediate): Add yearly baseline configuration options');
    console.log('   Phase 2 (Short-term): Implement interop priority boosting');
    console.log('   Phase 3 (Medium-term): Add contextual enforcement');
    console.log('   Phase 4 (Long-term): Full hybrid strategy with auto-adjusting levels');
  }

  async run() {
    try {
      await this.initialize();
      
      const yearlyAnalysis = this.analyzeByYear();
      const interopAnalysis = this.analyzeInteroperabilityPatterns();
      const strategyAnalysis = this.analyzeEnforcementStrategies();
      
      this.generateConfigurationExample();
      this.generateRecommendations();
      
      console.log('\n✅ Enforcement strategy analysis complete!');
      console.log('📋 Summary: Hybrid approach recommended - yearly baselines with per-feature overrides');
      
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new EnforcementStrategyAnalyzer();
  analyzer.run();
}

export default EnforcementStrategyAnalyzer;