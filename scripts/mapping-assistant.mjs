#!/usr/bin/env node

/**
 * Interactive Mapping Assistant
 * 
 * Assistive tool for the 5% human maintenance work. Provides guided workflows
 * to help maintainers quickly validate, update, and create feature mappings.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

class InteractiveMappingAssistant {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.webFeatures = null;
    this.suggestions = null;
  }

  async initialize() {
    console.log('🎯 Interactive Mapping Assistant');
    console.log('=====================================');
    console.log('Assistive tool for human maintainers to quickly manage feature mappings\n');
    
    // Load web-features database
    this.webFeatures = await import('web-features');
    console.log(`📊 Loaded ${Object.keys(this.webFeatures.features).length} features from web-features database\n`);
  }

  async showMainMenu() {
    console.log('🛠️  MAIN MENU:');
    console.log('1. 📋 Review mapping suggestions (from Enhanced Discovery)');
    console.log('2. 🔍 Quick feature lookup (validate a specific feature ID)');
    console.log('3. ✨ Create new mapping (guided wizard)');
    console.log('4. 🧹 Cleanup invalid mappings (find and fix)');
    console.log('5. 📈 Generate mapping report (coverage analysis)');
    console.log('6. 🚪 Exit\n');

    const choice = await this.prompt('Choose an option (1-6): ');
    
    switch (choice.trim()) {
      case '1': return await this.reviewSuggestions();
      case '2': return await this.quickLookup();
      case '3': return await this.createNewMapping();
      case '4': return await this.cleanupInvalidMappings();
      case '5': return await this.generateReport();
      case '6': return await this.exit();
      default: 
        console.log('❌ Invalid choice. Please try again.\n');
        return await this.showMainMenu();
    }
  }

  async reviewSuggestions() {
    console.log('\n📋 REVIEWING MAPPING SUGGESTIONS');
    console.log('==================================');
    console.log('Loading suggestions from Enhanced Discovery...\n');

    try {
      // Import our suggestion engine
      const SuggestionEngine = (await import('./suggest-mappings.mjs')).default;
      const engine = new SuggestionEngine();
      await engine.initialize();
      
      const directMatches = engine.findDirectNameMatches();
      const highPriority = engine.findHighPriorityFeatures();

      // Show top 10 most confident suggestions
      const allSuggestions = [
        ...directMatches.css.slice(0, 5),
        ...directMatches.js.slice(0, 3),
        ...directMatches.html.slice(0, 2)
      ].sort((a, b) => (b.confidence || b.priority || 0) - (a.confidence || a.priority || 0));

      console.log('🎯 TOP 10 MAPPING SUGGESTIONS (Highest Confidence):');
      allSuggestions.forEach((suggestion, i) => {
        const score = suggestion.confidence || suggestion.priority || 0;
        console.log(`   ${i + 1}. ${suggestion.featureId} -> "${suggestion.name}"`);
        console.log(`      Score: ${score} | Baseline: ${suggestion.baseline} | Category: ${suggestion.category}`);
        if (suggestion.reasoning) console.log(`      Reasoning: ${suggestion.reasoning}`);
        console.log('');
      });

      const action = await this.prompt('Choose: (a)ccept suggestions, (r)eview individually, (b)ack to menu: ');
      
      if (action.toLowerCase().startsWith('a')) {
        return await this.bulkAcceptSuggestions(allSuggestions.slice(0, 5));
      } else if (action.toLowerCase().startsWith('r')) {
        return await this.reviewIndividually(allSuggestions);
      } else {
        return await this.showMainMenu();
      }

    } catch (error) {
      console.log('❌ Failed to load suggestions:', error.message);
      return await this.showMainMenu();
    }
  }

  async quickLookup() {
    console.log('\n🔍 QUICK FEATURE LOOKUP');
    console.log('========================');
    
    const featureId = await this.prompt('Enter feature ID to validate: ');
    
    if (this.webFeatures.features[featureId]) {
      const feature = this.webFeatures.features[featureId];
      console.log(`\n✅ VALID FEATURE: "${feature.name}"`);
      console.log(`   ID: ${featureId}`);
      console.log(`   Baseline: ${feature.baseline?.status || 'unknown'}`);
      console.log(`   Description: ${feature.description_html || 'No description'}`);
      
      if (feature.baseline?.low_date) {
        console.log(`   Baseline Date: ${feature.baseline.low_date}`);
      }
      
      if (feature.caniuse) {
        console.log(`   Can I Use: https://caniuse.com/${feature.caniuse}`);
      }
      
      console.log(`   MDN: ${feature.mdn_url || 'Not available'}`);
      
    } else {
      console.log(`\n❌ INVALID FEATURE: "${featureId}"`);
      console.log('   This feature ID does not exist in the web-features database.');
      
      // Suggest similar features
      const similar = this.findSimilarFeatures(featureId);
      if (similar.length > 0) {
        console.log('\n💡 Did you mean one of these?');
        similar.slice(0, 5).forEach(f => {
          console.log(`   - ${f.id} -> "${f.name}"`);
        });
      }
    }
    
    const action = await this.prompt('\nPress Enter to continue...');
    return await this.showMainMenu();
  }

  async createNewMapping() {
    console.log('\n✨ CREATE NEW MAPPING WIZARD');
    console.log('==============================');
    
    const type = await this.prompt('Mapping type: (c)ss, (j)avascript, or (h)tml? ');
    const pattern = await this.prompt('Code pattern (e.g., "display: grid", "fetch()", "<dialog>"): ');
    const featureId = await this.prompt('Feature ID (will be validated): ');
    
    // Validate feature ID
    if (!this.webFeatures.features[featureId]) {
      console.log(`❌ Invalid feature ID: ${featureId}`);
      const similar = this.findSimilarFeatures(featureId);
      if (similar.length > 0) {
        console.log('💡 Similar features:');
        similar.slice(0, 3).forEach(f => console.log(`   - ${f.id}`));
      }
      return await this.createNewMapping();
    }
    
    const feature = this.webFeatures.features[featureId];
    console.log(`\n✅ Valid feature: "${feature.name}"`);
    console.log(`   Baseline: ${feature.baseline?.status || 'unknown'}`);
    
    const confirm = await this.prompt('Add this mapping? (y/n): ');
    if (confirm.toLowerCase().startsWith('y')) {
      console.log('\n📝 MAPPING CODE TO ADD:');
      console.log('Add this to your feature-mappings.js file:');
      
      if (type.toLowerCase().startsWith('c')) {
        console.log(`   "${pattern}": "${featureId}",`);
      } else if (type.toLowerCase().startsWith('j')) {
        console.log(`   "${pattern}": "${featureId}",`);
      } else if (type.toLowerCase().startsWith('h')) {
        console.log(`   "${pattern}": "${featureId}",`);
      }
      
      console.log('\n💡 Remember to:');
      console.log('   1. Add it to the correct mapping object');
      console.log('   2. Run validation: npm run validate-mappings');
      console.log('   3. Run tests: npm test');
    }
    
    return await this.showMainMenu();
  }

  async cleanupInvalidMappings() {
    console.log('\n🧹 CLEANUP INVALID MAPPINGS');
    console.log('=============================');
    console.log('Scanning current mappings for invalid feature IDs...\n');

    try {
      const { 
        CSS_PROPERTY_MAPPING, 
        JS_API_MAPPING, 
        HTML_FEATURE_MAPPING 
      } = await import('../src/utils/feature-mappings.js');

      const invalidMappings = [];
      
      // Check CSS mappings
      Object.entries(CSS_PROPERTY_MAPPING).forEach(([pattern, mapping]) => {
        if (typeof mapping === 'string') {
          if (!this.webFeatures.features[mapping]) {
            invalidMappings.push({ type: 'CSS', pattern, featureId: mapping });
          }
        } else if (typeof mapping === 'object') {
          Object.entries(mapping).forEach(([value, featureId]) => {
            if (!this.webFeatures.features[featureId]) {
              invalidMappings.push({ type: 'CSS', pattern: `${pattern}:${value}`, featureId });
            }
          });
        }
      });

      // Check JS mappings
      Object.entries(JS_API_MAPPING).forEach(([pattern, featureId]) => {
        if (featureId && !this.webFeatures.features[featureId]) {
          invalidMappings.push({ type: 'JS', pattern, featureId });
        }
      });

      // Check HTML mappings
      Object.entries(HTML_FEATURE_MAPPING).forEach(([pattern, featureId]) => {
        if (!this.webFeatures.features[featureId]) {
          invalidMappings.push({ type: 'HTML', pattern, featureId });
        }
      });

      if (invalidMappings.length === 0) {
        console.log('✅ All mappings are valid! No cleanup needed.');
      } else {
        console.log(`❌ Found ${invalidMappings.length} invalid mappings:`);
        invalidMappings.forEach((invalid, i) => {
          console.log(`   ${i + 1}. [${invalid.type}] ${invalid.pattern} -> ${invalid.featureId}`);
          
          // Suggest similar valid features
          const similar = this.findSimilarFeatures(invalid.featureId);
          if (similar.length > 0) {
            console.log(`      💡 Similar: ${similar[0].id}`);
          }
        });
        
        console.log('\n🔧 To fix these:');
        console.log('   1. Replace invalid IDs with similar valid ones');
        console.log('   2. Remove mappings that have no valid equivalent');
        console.log('   3. Run validation after changes');
      }

    } catch (error) {
      console.log('❌ Failed to scan mappings:', error.message);
    }
    
    const action = await this.prompt('\nPress Enter to continue...');
    return await this.showMainMenu();
  }

  async generateReport() {
    console.log('\n📈 MAPPING COVERAGE REPORT');
    console.log('===========================');
    
    try {
      const { 
        CSS_PROPERTY_MAPPING, 
        CSS_SELECTOR_MAPPING,
        CSS_FUNCTION_MAPPING,
        CSS_AT_RULE_MAPPING,
        JS_API_MAPPING, 
        HTML_FEATURE_MAPPING 
      } = await import('../src/utils/feature-mappings.js');

      const totalFeatures = Object.keys(this.webFeatures.features).length;
      
      // Count mappings
      let cssCount = Object.keys(CSS_PROPERTY_MAPPING).length;
      cssCount += Object.keys(CSS_SELECTOR_MAPPING || {}).length;
      cssCount += Object.keys(CSS_FUNCTION_MAPPING || {}).length;
      cssCount += Object.keys(CSS_AT_RULE_MAPPING || {}).length;
      
      const jsCount = Object.keys(JS_API_MAPPING).length;
      const htmlCount = Object.keys(HTML_FEATURE_MAPPING).length;
      const totalMappings = cssCount + jsCount + htmlCount;
      
      // Analyze by baseline status
      const mappedFeatureIds = new Set();
      
      Object.values(CSS_PROPERTY_MAPPING).forEach(mapping => {
        if (typeof mapping === 'string') mappedFeatureIds.add(mapping);
        else if (typeof mapping === 'object') {
          Object.values(mapping).forEach(id => mappedFeatureIds.add(id));
        }
      });
      
      Object.values(CSS_SELECTOR_MAPPING || {}).forEach(id => mappedFeatureIds.add(id));
      Object.values(CSS_FUNCTION_MAPPING || {}).forEach(id => mappedFeatureIds.add(id));
      Object.values(CSS_AT_RULE_MAPPING || {}).forEach(id => mappedFeatureIds.add(id));
      Object.values(JS_API_MAPPING).forEach(id => id && mappedFeatureIds.add(id));
      Object.values(HTML_FEATURE_MAPPING).forEach(id => mappedFeatureIds.add(id));
      mappedFeatureIds.delete(null);
      
      const baselineCoverage = { widely: 0, newly: 0, limited: 0, unknown: 0 };
      mappedFeatureIds.forEach(featureId => {
        const feature = this.webFeatures.features[featureId];
        const status = feature?.baseline?.status || 'unknown';
        baselineCoverage[status] = (baselineCoverage[status] || 0) + 1;
      });
      
      console.log('📊 COVERAGE STATISTICS:');
      console.log(`   Total web-features: ${totalFeatures}`);
      console.log(`   Total mappings: ${totalMappings}`);
      console.log(`   Unique features mapped: ${mappedFeatureIds.size}`);
      console.log(`   Coverage: ${Math.round((mappedFeatureIds.size / totalFeatures) * 100)}%`);
      console.log('');
      console.log('📋 BREAKDOWN BY TYPE:');
      console.log(`   CSS mappings: ${cssCount}`);
      console.log(`   JavaScript mappings: ${jsCount}`);
      console.log(`   HTML mappings: ${htmlCount}`);
      console.log('');
      console.log('🎯 BASELINE STATUS COVERAGE:');
      console.log(`   Widely supported: ${baselineCoverage.widely} features`);
      console.log(`   Newly supported: ${baselineCoverage.newly} features`);
      console.log(`   Limited support: ${baselineCoverage.limited} features`);
      console.log(`   Unknown status: ${baselineCoverage.unknown} features`);
      
      const coverageScore = Math.round(
        (baselineCoverage.widely * 3 + baselineCoverage.newly * 2 + baselineCoverage.limited * 1) / 
        mappedFeatureIds.size
      );
      console.log(`   Quality score: ${coverageScore}/3 (prioritizing widely supported features)`);
      
    } catch (error) {
      console.log('❌ Failed to generate report:', error.message);
    }
    
    const action = await this.prompt('\nPress Enter to continue...');
    return await this.showMainMenu();
  }

  findSimilarFeatures(query) {
    const features = Object.entries(this.webFeatures.features);
    const similar = [];
    
    features.forEach(([id, feature]) => {
      const nameScore = this.calculateSimilarity(query.toLowerCase(), feature.name.toLowerCase());
      const idScore = this.calculateSimilarity(query.toLowerCase(), id.toLowerCase());
      const maxScore = Math.max(nameScore, idScore);
      
      if (maxScore > 0.3) {
        similar.push({ id, name: feature.name, score: maxScore });
      }
    });
    
    return similar.sort((a, b) => b.score - a.score);
  }

  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    const words1 = str1.split(/[^a-z0-9]/);
    const words2 = str2.split(/[^a-z0-9]/);
    const overlap = words1.filter(word => words2.includes(word)).length;
    
    return overlap / Math.max(words1.length, words2.length);
  }

  async prompt(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  async exit() {
    console.log('\n👋 Thanks for using the Interactive Mapping Assistant!');
    console.log('Remember to run validation after any changes: npm run validate-mappings\n');
    this.rl.close();
    process.exit(0);
  }

  async run() {
    try {
      await this.initialize();
      await this.showMainMenu();
    } catch (error) {
      console.error('❌ Assistant failed:', error.message);
      this.rl.close();
      process.exit(1);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const assistant = new InteractiveMappingAssistant();
  assistant.run();
}

export default InteractiveMappingAssistant;