#!/usr/bin/env node

/**
 * Test script to verify BaselineDataManager works correctly with API pagination
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const BaselineDataManager = require('../src/utils/baseline-data-manager.js');

async function testBaselineManager() {
  console.log('🔍 Testing BaselineDataManager with API pagination...\n');

  const manager = new BaselineDataManager({
    cacheDir: '.test-cache',
    cacheDuration: 5000 // 5 seconds for testing
  });

  try {
    // Initialize manager
    await manager.initialize();

    // Test fetching all features
    console.log('📊 Fetching all Baseline features...');
    const features = await manager.getAllBaselineFeatures();
    console.log(`✅ Loaded ${features.size} features from webstatus.dev API`);

    // Test some specific feature lookups
    console.log('\n🔍 Testing specific feature lookups:');
    
    const testFeatures = ['grid', 'flexbox', 'fetch', 'dialog', 'container-queries'];
    testFeatures.forEach(featureId => {
      const info = manager.getFeatureInfo(featureId);
      const status = manager.getBaselineStatus(featureId);
      
      if (info) {
        console.log(`   ✅ ${featureId}: "${info.name}" (${status})`);
      } else {
        console.log(`   ❌ ${featureId}: not found`);
      }
    });

    // Test baseline status distribution
    console.log('\n📊 Baseline status distribution:');
    const statusCounts = { widely: 0, newly: 0, limited: 0, unknown: 0 };
    
    for (const [id, feature] of features) {
      const status = feature.baseline?.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} features`);
    });

    // Test search functionality
    console.log('\n🔍 Testing search functionality:');
    const cssResults = await manager.searchFeatures('CSS');
    console.log(`   Found ${cssResults.length} CSS-related features`);

    const gridResults = await manager.searchFeatures('grid');
    console.log(`   Found ${gridResults.length} grid-related features`);
    gridResults.slice(0, 3).forEach(feature => {
      console.log(`     • ${feature.id}: ${feature.name}`);
    });

    // Test features by status
    console.log('\n📈 Testing features by baseline status:');
    const widelySupported = await manager.getFeaturesByStatus('widely');
    console.log(`   Widely supported: ${widelySupported.length} features`);
    
    const newFeatures = await manager.getFeaturesByStatus('newly');
    console.log(`   Newly supported: ${newFeatures.length} features`);

    // Test cache stats
    console.log('\n💾 Cache statistics:');
    const stats = manager.getCacheStats();
    console.log(`   Memory cache size: ${stats.memoryCacheSize}`);
    console.log(`   Has fallback data: ${stats.hasFallbackData}`);
    console.log(`   Cache directory: ${stats.cacheDirectory}`);

    console.log('\n✅ BaselineDataManager test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testBaselineManager();
}