#!/usr/bin/env node

/**
 * Feature Status Monitor
 * 
 * Tracks baseline status changes over time and alerts maintainers when
 * features transition between baseline statuses (limited -> newly -> widely)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class FeatureStatusMonitor {
  constructor() {
    this.snapshotPath = join(__dirname, '..', '.baseline-cache', 'feature-status-snapshot.json');
    this.webFeatures = null;
    this.previousSnapshot = null;
    this.currentSnapshot = {};
  }

  async initialize() {
    console.log('📊 Feature Status Monitor');
    console.log('===========================');
    console.log('Tracking baseline status changes for mapped features\n');
    
    // Load web-features database
    this.webFeatures = await import('web-features');
    console.log(`📊 Loaded ${Object.keys(this.webFeatures.features).length} features from web-features database`);
    
    // Load previous snapshot if exists
    if (existsSync(this.snapshotPath)) {
      try {
        this.previousSnapshot = JSON.parse(readFileSync(this.snapshotPath, 'utf8'));
        console.log(`📁 Loaded previous snapshot: ${this.previousSnapshot.timestamp}`);
      } catch (error) {
        console.log('⚠️  Could not load previous snapshot, creating new baseline');
        this.previousSnapshot = null;
      }
    } else {
      console.log('📁 No previous snapshot found, creating new baseline');
    }
  }

  async getCurrentMappedFeatures() {
    const { 
      CSS_PROPERTY_MAPPING, 
      CSS_SELECTOR_MAPPING,
      CSS_FUNCTION_MAPPING,
      CSS_AT_RULE_MAPPING,
      JS_API_MAPPING, 
      HTML_FEATURE_MAPPING 
    } = await import('../src/utils/feature-mappings.js');

    const mappedFeatureIds = new Set();
    
    // Extract all mapped feature IDs
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
    return Array.from(mappedFeatureIds);
  }

  createCurrentSnapshot() {
    const mappedFeatures = this.getCurrentMappedFeatures();
    
    mappedFeatures.forEach(featureId => {
      const feature = this.webFeatures.features[featureId];
      if (feature) {
        this.currentSnapshot[featureId] = {
          name: feature.name,
          status: feature.baseline?.status || 'unknown',
          date: feature.baseline?.low_date || null,
          high_date: feature.baseline?.high_date || null
        };
      }
    });

    return {
      timestamp: new Date().toISOString(),
      total_features: mappedFeatures.length,
      features: this.currentSnapshot
    };
  }

  analyzeChanges() {
    if (!this.previousSnapshot) {
      console.log('🆕 First run - establishing baseline snapshot');
      return { changes: [], newFeatures: Object.keys(this.currentSnapshot), removedFeatures: [] };
    }

    const changes = [];
    const newFeatures = [];
    const removedFeatures = [];

    // Find status changes
    Object.entries(this.currentSnapshot).forEach(([featureId, current]) => {
      const previous = this.previousSnapshot.features[featureId];
      
      if (!previous) {
        newFeatures.push(featureId);
      } else if (previous.status !== current.status) {
        changes.push({
          featureId,
          name: current.name,
          oldStatus: previous.status,
          newStatus: current.status,
          oldDate: previous.date,
          newDate: current.date,
          direction: this.getStatusDirection(previous.status, current.status)
        });
      }
    });

    // Find removed features
    Object.keys(this.previousSnapshot.features).forEach(featureId => {
      if (!this.currentSnapshot[featureId]) {
        removedFeatures.push(featureId);
      }
    });

    return { changes, newFeatures, removedFeatures };
  }

  getStatusDirection(oldStatus, newStatus) {
    const statusOrder = { 'unknown': 0, 'limited': 1, 'newly': 2, 'widely': 3 };
    const oldOrder = statusOrder[oldStatus] || 0;
    const newOrder = statusOrder[newStatus] || 0;
    
    if (newOrder > oldOrder) return 'improvement';
    if (newOrder < oldOrder) return 'regression'; 
    return 'lateral';
  }

  generateReport(analysis) {
    console.log('\n📈 STATUS CHANGE ANALYSIS');
    console.log('==========================');
    
    if (analysis.changes.length === 0 && analysis.newFeatures.length === 0 && analysis.removedFeatures.length === 0) {
      console.log('✅ No changes detected since last run');
      return;
    }

    // Status changes
    if (analysis.changes.length > 0) {
      console.log(`\n🔄 STATUS CHANGES (${analysis.changes.length}):`);
      
      const improvements = analysis.changes.filter(c => c.direction === 'improvement');
      const regressions = analysis.changes.filter(c => c.direction === 'regression');
      const lateral = analysis.changes.filter(c => c.direction === 'lateral');
      
      if (improvements.length > 0) {
        console.log(`\n📈 IMPROVEMENTS (${improvements.length}):`);
        improvements.forEach(change => {
          console.log(`   ✅ ${change.featureId} - "${change.name}"`);
          console.log(`      ${change.oldStatus} → ${change.newStatus}`);
          if (change.newDate) console.log(`      Baseline date: ${change.newDate}`);
        });
      }
      
      if (regressions.length > 0) {
        console.log(`\n📉 REGRESSIONS (${regressions.length}):`);
        regressions.forEach(change => {
          console.log(`   ⚠️  ${change.featureId} - "${change.name}"`);
          console.log(`      ${change.oldStatus} → ${change.newStatus}`);
        });
      }
      
      if (lateral.length > 0) {
        console.log(`\n🔄 OTHER CHANGES (${lateral.length}):`);
        lateral.forEach(change => {
          console.log(`   ℹ️  ${change.featureId} - "${change.name}"`);
          console.log(`      ${change.oldStatus} → ${change.newStatus}`);
        });
      }
    }

    // New features
    if (analysis.newFeatures.length > 0) {
      console.log(`\n🆕 NEW MAPPED FEATURES (${analysis.newFeatures.length}):`);
      analysis.newFeatures.slice(0, 10).forEach(featureId => {
        const feature = this.currentSnapshot[featureId];
        console.log(`   + ${featureId} - "${feature.name}" (${feature.status})`);
      });
      if (analysis.newFeatures.length > 10) {
        console.log(`   ... and ${analysis.newFeatures.length - 10} more`);
      }
    }

    // Removed features
    if (analysis.removedFeatures.length > 0) {
      console.log(`\n🗑️ REMOVED MAPPED FEATURES (${analysis.removedFeatures.length}):`);
      analysis.removedFeatures.forEach(featureId => {
        console.log(`   - ${featureId}`);
      });
    }

    // Summary stats
    console.log('\n📊 SUMMARY:');
    console.log(`   Total tracked features: ${Object.keys(this.currentSnapshot).length}`);
    console.log(`   Status improvements: ${analysis.changes.filter(c => c.direction === 'improvement').length}`);
    console.log(`   Status regressions: ${analysis.changes.filter(c => c.direction === 'regression').length}`);
    console.log(`   New features added: ${analysis.newFeatures.length}`);
    console.log(`   Features removed: ${analysis.removedFeatures.length}`);
  }

  generateMaintenanceActions(analysis) {
    const actions = [];
    
    // Actions for improvements
    const improvements = analysis.changes.filter(c => c.direction === 'improvement');
    if (improvements.length > 0) {
      actions.push({
        type: 'opportunity',
        title: `${improvements.length} features improved baseline status`,
        description: 'Consider updating policy thresholds to be more permissive for newly "widely" supported features',
        features: improvements.map(c => c.featureId)
      });
    }
    
    // Actions for regressions
    const regressions = analysis.changes.filter(c => c.direction === 'regression');
    if (regressions.length > 0) {
      actions.push({
        type: 'warning',
        title: `${regressions.length} features regressed in baseline status`,
        description: 'Review these features and consider if policy thresholds need adjustment',
        features: regressions.map(c => c.featureId)
      });
    }

    // Actions for new features
    if (analysis.newFeatures.length > 0) {
      actions.push({
        type: 'info',
        title: `${analysis.newFeatures.length} new features added to mappings`,
        description: 'Update documentation and validate detection accuracy',
        features: analysis.newFeatures
      });
    }

    if (actions.length > 0) {
      console.log('\n🛠️ RECOMMENDED MAINTENANCE ACTIONS:');
      console.log('====================================');
      
      actions.forEach((action, i) => {
        const icon = { opportunity: '📈', warning: '⚠️', info: 'ℹ️' }[action.type];
        console.log(`\n${i + 1}. ${icon} ${action.title}`);
        console.log(`   ${action.description}`);
        if (action.features.length <= 5) {
          console.log(`   Features: ${action.features.join(', ')}`);
        } else {
          console.log(`   Features: ${action.features.slice(0, 3).join(', ')} and ${action.features.length - 3} more`);
        }
      });
    }

    return actions;
  }

  saveSnapshot(snapshot) {
    try {
      // Ensure cache directory exists
      const cacheDir = dirname(this.snapshotPath);
      if (!existsSync(cacheDir)) {
        import('fs').then(({ mkdirSync }) => {
          mkdirSync(cacheDir, { recursive: true });
        });
      }
      
      writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2));
      console.log(`\n💾 Snapshot saved: ${snapshot.timestamp}`);
    } catch (error) {
      console.log(`⚠️  Failed to save snapshot: ${error.message}`);
    }
  }

  async run() {
    try {
      await this.initialize();
      
      const mappedFeatures = await this.getCurrentMappedFeatures();
      console.log(`🎯 Monitoring ${mappedFeatures.length} mapped features\n`);
      
      const currentSnapshot = this.createCurrentSnapshot();
      const analysis = this.analyzeChanges();
      
      this.generateReport(analysis);
      const actions = this.generateMaintenanceActions(analysis);
      
      this.saveSnapshot(currentSnapshot);
      
      console.log('\n✅ Feature status monitoring complete!');
      
      // Exit with status code indicating if action is needed
      const needsAttention = analysis.changes.filter(c => c.direction === 'regression').length > 0;
      process.exit(needsAttention ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Status monitoring failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new FeatureStatusMonitor();
  monitor.run();
}

export default FeatureStatusMonitor;