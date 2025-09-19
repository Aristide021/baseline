#!/usr/bin/env node

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BaselineDataManager = require('../src/utils/baseline-data-manager.js');

async function debugBaselineData() {
  console.log('🔍 Debugging Baseline Data Loading');
  console.log('==================================');
  
  const mgr = new BaselineDataManager();
  await mgr.initialize();
  
  const features = await mgr.getAllBaselineFeatures();
  console.log('Total features loaded:', features.size);
  
  console.log('\n📋 Checking specific features:');
  const testIds = ['grid', 'container-queries', 'subgrid'];
  testIds.forEach(id => {
    const feature = features.get(id);
    if (feature) {
      console.log(`✅ ${id}: ${feature.baseline.status} (${feature.baseline.low_date})`);
    } else {
      console.log(`❌ ${id}: Not found`);
    }
  });
  
  console.log('\n📊 Sample features with baseline data:');
  let count = 0;
  for (const [id, feature] of features) {
    if (feature.baseline?.status !== 'unknown' && count < 10) {
      console.log(`${id}: ${feature.baseline.status} (${feature.baseline.low_date})`);
      count++;
    }
  }
  
  console.log(`\nFound ${count} features with non-unknown baseline status`);
}

debugBaselineData().catch(console.error);