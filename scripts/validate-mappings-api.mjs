#!/usr/bin/env node

/**
 * Validates feature mappings against actual webstatus.dev API with proper pagination
 * This replaces the web-features package approach with the official API
 */

// Use dynamic import since we're in ES module mode
const { 
  CSS_PROPERTY_MAPPING, 
  JS_API_MAPPING, 
  HTML_FEATURE_MAPPING 
} = await import('../src/utils/feature-mappings.js');

const API_BASE = 'https://api.webstatus.dev/v1/features';

async function fetchAllFeatures() {
  console.log('🔍 Fetching all features from webstatus.dev API with pagination...');
  
  const allFeatures = [];
  let pageToken = null;
  let pageCount = 0;
  
  do {
    pageCount++;
    const url = pageToken 
      ? `${API_BASE}?page_size=100&page_token=${encodeURIComponent(pageToken)}`
      : `${API_BASE}?page_size=100`;
    
    console.log(`   📄 Fetching page ${pageCount}...`);
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    allFeatures.push(...data.data);
    pageToken = data.metadata?.next_page_token;
    
    console.log(`   ✓ Page ${pageCount}: ${data.data.length} features (total so far: ${allFeatures.length})`);
    
  } while (pageToken);
  
  console.log(`\n📊 Successfully fetched ${allFeatures.length} total features from API`);
  return allFeatures;
}

async function validateMappings() {
  console.log('🔍 Validating feature mappings against webstatus.dev API...\n');

  try {
    // Fetch all features using proper pagination
    const features = await fetchAllFeatures();
    const validFeatureIds = new Set(features.map(feature => feature.feature_id));
    
    console.log(`\n📊 Found ${validFeatureIds.size} features in webstatus.dev database`);

    // Validate CSS mappings
    console.log('\n🎨 Validating CSS feature mappings...');
    const cssResults = await validateCSSMappings(validFeatureIds);

    // Validate JavaScript mappings  
    console.log('\n⚡ Validating JavaScript feature mappings...');
    const jsResults = await validateJSMappings(validFeatureIds);

    // Validate HTML mappings
    console.log('\n📄 Validating HTML feature mappings...');
    const htmlResults = await validateHTMLMappings(validFeatureIds);

    // Summary
    const totalValid = cssResults.valid + jsResults.valid + htmlResults.valid;
    const totalInvalid = cssResults.invalid + jsResults.invalid + htmlResults.invalid;
    
    console.log('\n✅ Mapping validation complete!');
    console.log(`📊 Overall Results: ${totalValid} valid, ${totalInvalid} invalid mappings`);
    
    if (totalInvalid === 0) {
      console.log('🎉 All mappings are valid!');
    }

    return { totalValid, totalInvalid };

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
        issues.push(`❌ ${cssFeature} → ${mappedId} (not found in webstatus.dev)`);
      }
    } else if (typeof mappedId === 'object') {
      // Handle nested mappings like display: { grid: 'grid' }
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
      issues.push(`❌ ${jsFeature} → ${mappedId} (not found in webstatus.dev)`);
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
      issues.push(`❌ ${htmlFeature} → ${mappedId} (not found in webstatus.dev)`);
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

export { validateMappings, fetchAllFeatures };