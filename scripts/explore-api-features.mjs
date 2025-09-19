#!/usr/bin/env node

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BaselineDataManager = require('../src/utils/baseline-data-manager.js');

async function exploreAPIFeatures() {
  console.log('🔍 Exploring webstatus.dev API Features');
  console.log('=====================================');
  
  const mgr = new BaselineDataManager();
  await mgr.initialize();
  
  const features = await mgr.getAllBaselineFeatures();
  console.log('Total features loaded from API:', features.size);
  
  console.log('\n📋 All feature IDs from API:');
  const allIds = Array.from(features.keys()).sort();
  allIds.forEach((id, index) => {
    if (index < 50) { // Show first 50
      const feature = features.get(id);
      console.log(`${id}: "${feature.name}" (${feature.baseline.status})`);
    }
  });
  
  if (allIds.length > 50) {
    console.log(`... and ${allIds.length - 50} more`);
  }
  
  console.log('\n🔍 Looking for Grid-related features:');
  allIds
    .filter(id => id.toLowerCase().includes('grid') || features.get(id).name?.toLowerCase().includes('grid'))
    .forEach(id => {
      const feature = features.get(id);
      console.log(`✅ ${id}: "${feature.name}" (${feature.baseline.status}, ${feature.baseline.low_date})`);
    });
    
  console.log('\n🔍 Looking for Container-related features:');
  allIds
    .filter(id => id.toLowerCase().includes('container') || features.get(id).name?.toLowerCase().includes('container'))
    .forEach(id => {
      const feature = features.get(id);
      console.log(`✅ ${id}: "${feature.name}" (${feature.baseline.status}, ${feature.baseline.low_date})`);
    });

  // Test baseline_date queries
  console.log('\n📅 Testing baseline_date queries:');
  try {
    const features2023 = await mgr.queryFeaturesByBaselineYear(2023);
    console.log(`Features from 2023: ${features2023.length}`);
    if (features2023.length > 0) {
      console.log('Sample 2023 features:');
      features2023.slice(0, 5).forEach(feature => {
        console.log(`  • ${feature.name} (baseline: ${feature.baseline})`);
      });
    }
  } catch (error) {
    console.log(`Error querying 2023 features: ${error.message}`);
  }
}

exploreAPIFeatures().catch(console.error);