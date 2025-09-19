#!/usr/bin/env node

/**
 * Script to fix test feature IDs to match our corrected mappings
 */

import fs from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { JS_API_MAPPING, CSS_PROPERTY_MAPPING, HTML_FEATURE_MAPPING } = require('../src/utils/feature-mappings.js');

async function fixJSDetectorTests() {
  console.log('🔧 Fixing JS feature detector tests...');
  
  const testFile = '/Users/sheldon/baseline/tests/detectors/js-feature-detector.test.js';
  let content = await fs.readFile(testFile, 'utf8');
  
  // Map of incorrect feature IDs to correct ones based on our mappings
  const corrections = [
    // Fetch API corrections  
    ['featureId: \'fetch-api\'', 'featureId: \'fetch\''],
    
    // Observer API corrections
    ['featureId: \'intersection-observer\'', 'featureId: \'intersection-observer\''], // This one is correct
    ['featureId: \'resize-observer\'', 'featureId: \'resize-observer\''], // This one is correct
    
    // Worker corrections
    ['featureId: \'web-workers\'', 'featureId: \'dedicated-workers\''],
    ['featureId: \'shared-workers\'', 'featureId: \'shared-workers\''], // This one is correct
    
    // Modern JS - these might not have direct mappings, need to check
    ['featureId: \'js-async-await\'', 'featureId: \'async-await\''],
    ['featureId: \'js-arrow-functions\'', 'featureId: \'arrow-functions\''],
    ['featureId: \'js-template-literals\'', 'featureId: \'template-literals\''],
    ['featureId: \'js-spread-syntax\'', 'featureId: \'spread-syntax\''],
    ['featureId: \'js-optional-chaining\'', 'featureId: \'optional-chaining\''],
    ['featureId: \'js-nullish-coalescing\'', 'featureId: \'nullish-coalescing\''],
    ['featureId: \'js-classes\'', 'featureId: \'class\''],
    ['featureId: \'js-class-fields\'', 'featureId: \'class-fields-private\''],
    ['featureId: \'js-destructuring\'', 'featureId: \'destructuring-assignment\''],
  ];
  
  corrections.forEach(([oldId, newId]) => {
    content = content.replaceAll(oldId, newId);
  });
  
  await fs.writeFile(testFile, content);
  console.log('✅ Fixed JS detector tests');
}

async function checkActualMappings() {
  console.log('🔍 Checking what features we actually support...\n');
  
  console.log('JavaScript API mappings:');
  Object.entries(JS_API_MAPPING).forEach(([api, featureId]) => {
    console.log(`  ${api} → ${featureId}`);
  });
  
  console.log('\nCSS property mappings:');
  Object.entries(CSS_PROPERTY_MAPPING).forEach(([prop, mapping]) => {
    if (typeof mapping === 'object') {
      console.log(`  ${prop}:`);
      Object.entries(mapping).forEach(([value, featureId]) => {
        console.log(`    ${value} → ${featureId}`);
      });
    } else {
      console.log(`  ${prop} → ${mapping}`);
    }
  });
  
  console.log('\nHTML element mappings:');
  Object.entries(HTML_FEATURE_MAPPING).forEach(([element, featureId]) => {
    console.log(`  ${element} → ${featureId}`);
  });
}

async function main() {
  await checkActualMappings();
  await fixJSDetectorTests();
  
  console.log('\n✅ Test fixes completed. Run npm test to verify.');
}

main().catch(console.error);