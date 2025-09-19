#!/usr/bin/env node

/**
 * Validates feature mappings against actual web-features database
 * This ensures our hardcoded mappings are correct
 */

// Use dynamic import since we're in ES module mode
const { 
  CSS_PROPERTY_MAPPING, 
  JS_API_MAPPING, 
  HTML_FEATURE_MAPPING 
} = await import('../src/utils/feature-mappings.js');

async function validateMappings() {
  console.log('🔍 Validating feature mappings against web-features package...\n');

  try {
    // Use web-features package instead of API (gets all 1076 features)
    const webFeatures = await import('web-features');
    const validFeatureIds = new Set(Object.keys(webFeatures.features));
    
    console.log(`📊 Found ${validFeatureIds.size} features in web-features database`);

    // Validate CSS mappings
    console.log('\n🎨 Validating CSS feature mappings...');
    await validateCSSMappings(validFeatureIds);

    // Validate JavaScript mappings  
    console.log('\n⚡ Validating JavaScript feature mappings...');
    await validateJSMappings(validFeatureIds);

    // Validate HTML mappings
    console.log('\n📄 Validating HTML feature mappings...');
    await validateHTMLMappings(validFeatureIds);

    console.log('\n✅ Mapping validation complete!');

  } catch (error) {
    console.error('❌ Failed to validate mappings:', error.message);
    process.exit(1);
  }
}

async function validateCSSMappings(validFeatureIds) {
  const issues = [];
  const validMappings = [];

  for (const [cssFeature, mappedId] of Object.entries(CSS_PROPERTY_MAPPING)) {
    if (typeof mappedId === 'string') {
      if (validFeatureIds.has(mappedId)) {
        validMappings.push(cssFeature);
      } else {
        issues.push(`❌ ${cssFeature} → ${mappedId} (not found in web-features)`);
      }
    } else if (typeof mappedId === 'object') {
      // Handle nested mappings like display: { grid: 'css-grid' }
      for (const [value, nestedId] of Object.entries(mappedId)) {
        if (validFeatureIds.has(nestedId)) {
          validMappings.push(`${cssFeature}:${value}`);
        } else {
          issues.push(`❌ ${cssFeature}:${value} → ${nestedId} (not found)`);
        }
      }
    }
  }

  console.log(`   ✅ ${validMappings.length} valid CSS mappings`);
  if (issues.length > 0) {
    console.log(`   ❌ ${issues.length} invalid CSS mappings:`);
    issues.forEach(issue => console.log(`      ${issue}`));
  }

  return { valid: validMappings.length, invalid: issues.length };
}

async function validateJSMappings(validFeatureIds) {
  const issues = [];
  const validMappings = [];

  for (const [jsFeature, mappedId] of Object.entries(JS_API_MAPPING)) {
    if (validFeatureIds.has(mappedId)) {
      validMappings.push(jsFeature);
    } else {
      issues.push(`❌ ${jsFeature} → ${mappedId} (not found in web-features)`);
    }
  }

  console.log(`   ✅ ${validMappings.length} valid JS mappings`);
  if (issues.length > 0) {
    console.log(`   ❌ ${issues.length} invalid JS mappings:`);
    issues.forEach(issue => console.log(`      ${issue}`));
  }

  return { valid: validMappings.length, invalid: issues.length };
}

async function validateHTMLMappings(validFeatureIds) {
  const issues = [];
  const validMappings = [];

  for (const [htmlFeature, mappedId] of Object.entries(HTML_FEATURE_MAPPING)) {
    if (validFeatureIds.has(mappedId)) {
      validMappings.push(htmlFeature);
    } else {
      issues.push(`❌ ${htmlFeature} → ${mappedId} (not found in web-features)`);
    }
  }

  console.log(`   ✅ ${validMappings.length} valid HTML mappings`);
  if (issues.length > 0) {
    console.log(`   ❌ ${issues.length} invalid HTML mappings:`);
    issues.forEach(issue => console.log(`      ${issue}`));
  }

  return { valid: validMappings.length, invalid: issues.length };
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  validateMappings();
}

export { validateMappings };