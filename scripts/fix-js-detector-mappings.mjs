#!/usr/bin/env node

/**
 * Script to update JS detector to use mapping functions instead of hardcoded feature IDs
 */

import fs from 'fs/promises';

async function fixJSDetectorMappings() {
  console.log('🔧 Fixing JS detector to use mapping functions...');
  
  const detectorFile = '/Users/sheldon/baseline/src/detectors/js-feature-detector.js';
  let content = await fs.readFile(detectorFile, 'utf8');
  
  // Replace hardcoded feature ID assignments with mapping function calls
  const replacements = [
    // Pattern: const featureId = 'js-something'; 
    // Replace with: const detectorId = 'js-something'; const featureId = getJSAPIFeature(detectorId);
    [
      /const featureId = '(js-[^']+)';/g,
      "const detectorId = '$1';\n    const featureId = getJSAPIFeature(detectorId);"
    ],
    
    // Update feature detection tracking to use detectorId
    [
      /this\.isFeatureDetected\(featureId,/g,
      "this.isFeatureDetected(detectorId,"
    ],
    [
      /this\.markFeatureDetected\(featureId,/g,  
      "this.markFeatureDetected(detectorId,"
    ]
  ];
  
  replacements.forEach(([pattern, replacement]) => {
    content = content.replace(pattern, replacement);
  });
  
  await fs.writeFile(detectorFile, content);
  console.log('✅ Fixed JS detector mappings');
}

async function main() {
  await fixJSDetectorMappings();
  console.log('\n✅ JS detector fixes completed. Run npm test to verify.');
}

main().catch(console.error);