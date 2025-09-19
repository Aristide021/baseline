#!/usr/bin/env node

/**
 * Research script to identify high-priority CSS features for Baseline GitHub Action
 * 
 * This script:
 * 1. Fetches all features from webstatus.dev API
 * 2. Filters for CSS-related features
 * 3. Categorizes them by importance/usage
 * 4. Returns a prioritized list of 50-100 CSS features
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class CSSFeatureResearcher {
  constructor() {
    this.apiBase = 'https://api.webstatus.dev/v1/features';
    this.allFeatures = [];
    this.cssFeatures = [];
    this.prioritizedFeatures = [];
  }

  /**
   * Fetch all features with pagination support
   */
  async fetchAllFeatures() {
    const fetch = (await import('node-fetch')).default;
    let allData = [];
    let pageToken = null;
    
    console.log('🔍 Fetching all features from webstatus.dev API...');
    
    do {
      let url = `${this.apiBase}?page_size=100`;
      if (pageToken) {
        url += `&page_token=${pageToken}`;
      }
      
      console.log(`   Fetching page... (${allData.length} features so far)`);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const { data, metadata } = await response.json();
        allData = allData.concat(data);
        pageToken = metadata?.next_page_token;
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to fetch features: ${error.message}`);
        throw error;
      }
    } while (pageToken);
    
    this.allFeatures = allData;
    console.log(`✅ Fetched ${this.allFeatures.length} total features`);
    
    return this.allFeatures;
  }

  /**
   * Identify CSS-related features using multiple detection strategies
   */
  filterCSSFeatures() {
    console.log('🎨 Filtering CSS-related features...');
    
    // CSS keywords that indicate CSS features
    const cssKeywords = [
      'css', 'grid', 'flex', 'flexbox', 'container', 'query', 'queries',
      'selector', 'pseudo', 'property', 'value', 'function', 'calc',
      'clamp', 'min', 'max', 'var', 'custom-properties', 'logical',
      'animation', 'transition', 'transform', 'filter', 'backdrop',
      'color', 'font', 'text', 'layout', 'position', 'display',
      'overflow', 'clip', 'mask', 'shape', 'border', 'outline',
      'background', 'gradient', 'image', 'aspect-ratio', 'gap',
      'margin', 'padding', 'width', 'height', 'box', 'sizing',
      'align', 'justify', 'place', 'order', 'z-index', 'opacity',
      'visibility', 'cursor', 'pointer-events', 'user-select',
      'resize', 'scroll', 'writing-mode', 'direction', 'unicode',
      'white-space', 'word', 'line-height', 'letter-spacing',
      'text-decoration', 'text-shadow', 'box-shadow', 'drop-shadow'
    ];

    // CSS at-rules
    const cssAtRules = [
      '@media', '@supports', '@import', '@charset', '@namespace',
      '@keyframes', '@page', '@font-face', '@layer', '@container',
      '@property', '@counter-style'
    ];

    // CSS selectors
    const cssSelectors = [
      ':has', ':is', ':where', ':not', ':nth', ':first', ':last',
      ':only', ':target', ':focus', ':hover', ':active', ':visited',
      ':checked', ':disabled', ':enabled', ':required', ':optional',
      ':valid', ':invalid', ':in-range', ':out-of-range', ':read-only',
      ':read-write', '::before', '::after', '::first-line', '::first-letter',
      '::selection', '::backdrop', '::marker', '::placeholder'
    ];

    // CSS functions
    const cssFunctions = [
      'calc', 'clamp', 'min', 'max', 'var', 'rgb', 'rgba', 'hsl', 'hsla',
      'url', 'attr', 'counter', 'linear-gradient', 'radial-gradient',
      'conic-gradient', 'repeat', 'fit-content', 'minmax', 'repeat'
    ];

    this.cssFeatures = this.allFeatures.filter(feature => {
      const name = feature.name.toLowerCase();
      const id = feature.feature_id.toLowerCase();
      const description = (feature.description || '').toLowerCase();
      
      // Check if it's explicitly CSS-related
      const hasExplicitCSS = name.includes('css') || id.includes('css');
      
      // Check for CSS keywords
      const hasKeywords = cssKeywords.some(keyword => 
        name.includes(keyword) || id.includes(keyword) || description.includes(keyword)
      );
      
      // Check for CSS at-rules (in name or description)
      const hasAtRules = cssAtRules.some(rule => 
        name.includes(rule.substring(1)) || description.includes(rule)
      );
      
      // Check for CSS selectors
      const hasSelectors = cssSelectors.some(selector => 
        name.includes(selector) || description.includes(selector) || id.includes(selector.replace(':', '').replace('::', ''))
      );
      
      // Check for CSS functions
      const hasFunctions = cssFunctions.some(func => 
        name.includes(func) || id.includes(func) || description.includes(func)
      );
      
      // Exclude JavaScript APIs, DOM APIs, and HTML features that might match keywords
      const isNotJS = !name.includes('javascript') && !name.includes('api') && !name.includes('dom');
      const isNotHTML = !id.includes('html') || name.includes('css') || hasExplicitCSS;
      
      return (hasExplicitCSS || hasKeywords || hasAtRules || hasSelectors || hasFunctions) && 
             isNotJS && isNotHTML;
    });

    console.log(`✅ Found ${this.cssFeatures.length} CSS-related features`);
    return this.cssFeatures;
  }

  /**
   * Score and prioritize CSS features based on multiple criteria
   */
  prioritizeFeatures() {
    console.log('📊 Scoring and prioritizing CSS features...');
    
    const scoredFeatures = this.cssFeatures.map(feature => {
      let score = 0;
      let category = 'Other';
      let reasoning = [];
      
      const name = feature.name.toLowerCase();
      const id = feature.feature_id.toLowerCase();
      const description = (feature.description || '').toLowerCase();
      
      // Baseline status scoring (higher score for more widely supported)
      if (feature.baseline?.status === 'widely') {
        score += 50;
        reasoning.push('Widely supported in Baseline');
      } else if (feature.baseline?.status === 'newly') {
        score += 30;
        reasoning.push('Newly supported in Baseline');
      } else if (feature.baseline?.status === 'limited') {
        score += 20;
        reasoning.push('Limited Baseline support');
      } else {
        score += 5;
        reasoning.push('Unknown/No Baseline status');
      }
      
      // Category-based scoring and classification
      if (name.includes('grid') || id.includes('grid')) {
        score += 45;
        category = 'Layout';
        reasoning.push('CSS Grid - critical layout feature');
      } else if (name.includes('flex') || id.includes('flex')) {
        score += 40;
        category = 'Layout';
        reasoning.push('Flexbox - essential layout feature');
      } else if (name.includes('container') && (name.includes('query') || name.includes('queries'))) {
        score += 35;
        category = 'Responsive';
        reasoning.push('Container queries - modern responsive design');
      } else if (name.includes(':has') || id.includes('has-selector')) {
        score += 40;
        category = 'Selectors';
        reasoning.push(':has() - powerful CSS selector');
      } else if (name.includes(':is') || name.includes(':where')) {
        score += 35;
        category = 'Selectors';
        reasoning.push('Modern CSS selectors (:is/:where)');
      } else if (name.includes('clamp') || name.includes('min') || name.includes('max')) {
        score += 30;
        category = 'Functions';
        reasoning.push('CSS math functions - responsive design');
      } else if (name.includes('calc')) {
        score += 35;
        category = 'Functions';
        reasoning.push('CSS calc() - fundamental math function');
      } else if (name.includes('custom-properties') || name.includes('var')) {
        score += 40;
        category = 'Variables';
        reasoning.push('CSS custom properties - essential for maintainability');
      } else if (name.includes('logical') && (name.includes('properties') || name.includes('property'))) {
        score += 25;
        category = 'Logical Properties';
        reasoning.push('CSS logical properties - internationalization');
      } else if (name.includes('aspect-ratio')) {
        score += 30;
        category = 'Layout';
        reasoning.push('Aspect ratio - modern responsive images/videos');
      } else if (name.includes('gap') && (name.includes('flex') || name.includes('grid'))) {
        score += 30;
        category = 'Layout';
        reasoning.push('CSS gap - spacing in modern layouts');
      } else if (name.includes('@layer') || name.includes('cascade') && name.includes('layer')) {
        score += 20;
        category = 'At-Rules';
        reasoning.push('CSS cascade layers - advanced styling control');
      } else if (name.includes('color') && (name.includes('function') || name.includes('space') || name.includes('gamut'))) {
        score += 25;
        category = 'Color';
        reasoning.push('Modern color features - better color control');
      } else if (name.includes('backdrop-filter')) {
        score += 20;
        category = 'Effects';
        reasoning.push('Backdrop filter - modern visual effects');
      } else if (name.includes('scroll') && (name.includes('snap') || name.includes('behavior'))) {
        score += 25;
        category = 'Interaction';
        reasoning.push('CSS scroll features - enhanced UX');
      }
      
      // Usage/popularity indicators (based on common patterns)
      const commonPatterns = [
        'display', 'position', 'width', 'height', 'margin', 'padding',
        'border', 'background', 'color', 'font', 'text', 'box-shadow',
        'transform', 'transition', 'animation', 'opacity', 'overflow'
      ];
      
      if (commonPatterns.some(pattern => name.includes(pattern) || id.includes(pattern))) {
        score += 15;
        reasoning.push('Commonly used CSS feature');
      }
      
      // Modern/cutting-edge features get bonus points
      const modernFeatures = [
        'subgrid', 'intrinsic', 'fit-content', 'scroll-timeline',
        'view-transition', 'anchor', 'popover', 'focus-visible'
      ];
      
      if (modernFeatures.some(modern => name.includes(modern) || id.includes(modern))) {
        score += 15;
        reasoning.push('Modern/cutting-edge CSS feature');
      }
      
      // Features with MDN documentation get bonus points
      if (feature.mdn_url) {
        score += 10;
        reasoning.push('Has MDN documentation');
      }
      
      // Features with specification links get bonus points
      if (feature.spec?.url) {
        score += 5;
        reasoning.push('Has specification reference');
      }
      
      return {
        ...feature,
        score,
        category,
        reasoning: reasoning.join(', '),
        priority: score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'
      };
    });
    
    // Sort by score (highest first)
    this.prioritizedFeatures = scoredFeatures.sort((a, b) => b.score - a.score);
    
    console.log(`✅ Scored and prioritized ${this.prioritizedFeatures.length} CSS features`);
    return this.prioritizedFeatures;
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('📝 Generating comprehensive CSS feature report...');
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalFeatures: this.allFeatures.length,
        cssFeatures: this.cssFeatures.length,
        prioritizedFeatures: this.prioritizedFeatures.length
      },
      summary: {
        highPriority: this.prioritizedFeatures.filter(f => f.priority === 'High').length,
        mediumPriority: this.prioritizedFeatures.filter(f => f.priority === 'Medium').length,
        lowPriority: this.prioritizedFeatures.filter(f => f.priority === 'Low').length
      },
      categories: {},
      topFeatures: this.prioritizedFeatures.slice(0, 100).map(feature => ({
        id: feature.feature_id,
        name: feature.name,
        score: feature.score,
        priority: feature.priority,
        category: feature.category,
        baseline: feature.baseline?.status || 'unknown',
        since: feature.baseline?.since || 'N/A',
        description: feature.description || '',
        reasoning: feature.reasoning,
        mdn_url: feature.mdn_url || '',
        spec_url: feature.spec?.url || ''
      })),
      recommendations: {
        immediate: [], // Top 20 features to add immediately
        shortTerm: [], // Next 30 features for short-term expansion
        longTerm: [] // Remaining 50 features for long-term consideration
      }
    };
    
    // Group by categories
    this.prioritizedFeatures.forEach(feature => {
      if (!report.categories[feature.category]) {
        report.categories[feature.category] = [];
      }
      report.categories[feature.category].push({
        id: feature.feature_id,
        name: feature.name,
        score: feature.score,
        priority: feature.priority
      });
    });
    
    // Sort categories by average score
    Object.keys(report.categories).forEach(category => {
      report.categories[category].sort((a, b) => b.score - a.score);
    });
    
    // Create recommendations
    report.recommendations.immediate = report.topFeatures.slice(0, 20);
    report.recommendations.shortTerm = report.topFeatures.slice(20, 50);
    report.recommendations.longTerm = report.topFeatures.slice(50, 100);
    
    return report;
  }

  /**
   * Print summary to console
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🎨 CSS FEATURE RESEARCH SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📊 OVERVIEW:`);
    console.log(`   Total features in database: ${report.metadata.totalFeatures.toLocaleString()}`);
    console.log(`   CSS-related features: ${report.metadata.cssFeatures}`);
    console.log(`   High priority: ${report.summary.highPriority}`);
    console.log(`   Medium priority: ${report.summary.mediumPriority}`);
    console.log(`   Low priority: ${report.summary.lowPriority}`);
    
    console.log(`\n🏷️ CATEGORIES:`);
    Object.entries(report.categories).forEach(([category, features]) => {
      const avgScore = features.reduce((sum, f) => sum + f.score, 0) / features.length;
      console.log(`   ${category}: ${features.length} features (avg score: ${avgScore.toFixed(1)})`);
    });
    
    console.log(`\n🏆 TOP 20 IMMEDIATE RECOMMENDATIONS:`);
    report.recommendations.immediate.forEach((feature, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${feature.id} (score: ${feature.score})`);
      console.log(`       "${feature.name}" [${feature.category}] - ${feature.baseline}`);
    });
    
    console.log(`\n📋 FEATURE CATEGORIES BREAKDOWN:`);
    Object.entries(report.categories).forEach(([category, features]) => {
      console.log(`\n   ${category.toUpperCase()}:`);
      features.slice(0, 5).forEach(feature => {
        console.log(`     • ${feature.id} - "${feature.name}" (${feature.score})`);
      });
      if (features.length > 5) {
        console.log(`     ... and ${features.length - 5} more`);
      }
    });
    
    console.log(`\n💡 RECOMMENDATIONS:`);
    console.log(`   1. Add the top 20 features immediately for maximum impact`);
    console.log(`   2. Focus on Layout, Functions, and Selectors categories first`);
    console.log(`   3. Prioritize features with "widely" Baseline status`);
    console.log(`   4. Consider usage patterns in your target projects`);
    
    console.log(`\n📄 Full report saved to: css-feature-research-report.json`);
    console.log('='.repeat(80));
  }

  /**
   * Run the complete research workflow
   */
  async run() {
    console.log('🚀 Starting CSS Feature Research for Baseline GitHub Action\n');
    
    try {
      // Step 1: Fetch all features
      await this.fetchAllFeatures();
      
      // Step 2: Filter CSS features
      this.filterCSSFeatures();
      
      // Step 3: Score and prioritize
      this.prioritizeFeatures();
      
      // Step 4: Generate report
      const report = this.generateReport();
      
      // Step 5: Save to file
      const reportPath = join(__dirname, '..', 'css-feature-research-report.json');
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      // Step 6: Print summary
      this.printSummary(report);
      
      return report;
      
    } catch (error) {
      console.error('❌ Research failed:', error.message);
      throw error;
    }
  }
}

// Run the research if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const researcher = new CSSFeatureResearcher();
  researcher.run()
    .then(() => {
      console.log('\n✅ CSS feature research completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ CSS feature research failed:', error.message);
      process.exit(1);
    });
}

export default CSSFeatureResearcher;