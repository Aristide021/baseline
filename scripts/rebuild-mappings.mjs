#!/usr/bin/env node

/**
 * Rebuilds feature mappings using correct web-features IDs
 * This fixes the invalid mappings discovered by validation
 */

async function rebuildMappings() {
  console.log('🔧 Rebuilding feature mappings with correct web-features IDs...\n');

  const webFeatures = await import('web-features');
  const featuresData = webFeatures.features;
  const features = Object.keys(featuresData);
  
  console.log(`📊 Available features: ${features.length}`);

  // Build corrected CSS property mappings
  const CSS_PROPERTY_MAPPING = {
    // Layout
    'display': {
      'grid': 'grid',
      'flex': 'flexbox',
      'contents': 'display-contents'
    },
    'container-type': 'container-queries',
    'container-name': 'container-queries',
    'gap': 'flexbox-gap',
    'grid-gap': 'flexbox-gap',
    
    // Animations & Transitions
    'animation': 'animations-css',
    'animation-name': 'animations-css',
    'animation-duration': 'animations-css',
    'transition': 'transitions',
    'transform': 'transforms2d',
    'transform-origin': 'transforms2d',
    
    // Modern CSS Features
    'aspect-ratio': 'aspect-ratio',
    'accent-color': 'accent-color',
    'color-scheme': 'color-scheme',
    'backdrop-filter': 'backdrop-filter',
    
    // Typography
    'font-feature-settings': 'font-feature-settings',
    'font-variant-numeric': 'font-variant-numeric',
    'text-decoration-thickness': 'text-decoration',
    
    // Box Model
    'box-sizing': 'box-sizing',
    'overflow': 'overflow',
    'position': 'absolute-positioning',
    
    // Colors
    'color': 'currentcolor',
    'opacity': 'opacity'
  };

  // Build corrected JavaScript API mappings  
  const JS_API_MAPPING = {
    // Fetch & Networking
    'fetch': 'fetch',
    'AbortController': 'aborting',
    'AbortSignal': 'aborting',
    'Request': 'fetch',
    'Response': 'fetch',
    'Headers': 'fetch',
    
    // Observers
    'IntersectionObserver': 'intersection-observer',
    'MutationObserver': 'mutationobserver',
    'ResizeObserver': 'resize-observer',
    
    // Web Workers
    'Worker': 'dedicated-workers',
    'SharedWorker': 'shared-workers',
    'ServiceWorker': 'service-workers',
    
    // Modern APIs
    'URL': 'url',
    'URLSearchParams': 'url',
    'Promise': 'promise',
    'Map': 'map',
    'Set': 'set',
    'WeakMap': 'weakmap',
    'WeakSet': 'weakset',
    
    // Array Methods
    'Array.prototype.includes': 'array-includes',
    'Array.prototype.find': 'array-find',
    'Array.prototype.findIndex': 'array-find',
    'Array.from': 'array-from',
    
    // Object Methods (removing unsupported mappings)
    // 'Object.assign': 'object-assign', // Not in web-features
    // 'Object.entries': 'object-entries', // Not in web-features  
    // 'Object.keys': 'object-keys', // Not in web-features
    // 'Object.values': 'object-values' // Not in web-features
  };

  // Build corrected HTML feature mappings
  const HTML_FEATURE_MAPPING = {
    // Form Elements
    'input[type="color"]': 'input-color',
    'input[type="date"]': 'input-date-time',
    'input[type="email"]': 'input-date-time',
    'input[type="number"]': 'input-number',
    'input[type="range"]': 'input-range',
    'input[type="search"]': 'input-date-time',
    'input[type="tel"]': 'input-date-time',
    'input[type="time"]': 'input-date-time',
    'input[type="url"]': 'input-date-time',
    
    // Semantic Elements
    'dialog': 'dialog',
    'details': 'details',
    'summary': 'details',
    'article': 'article',
    'aside': 'aside', 
    'footer': 'header-footer',
    'header': 'header-footer',
    'main': 'main',
    'nav': 'nav',
    'section': 'section',
    
    // Media Elements
    'audio': 'audio',
    'video': 'video',
    'picture': 'picture',
    'source': 'picture',
    
    // Interactive Elements
    'button': 'button',
    'select': 'select',
    'textarea': 'textarea',
    
    // Data Elements
    'datalist': 'datalist',
    'output': 'output',
    
    // Custom Elements
    'slot': 'slot',
    'template': 'template'
  };

  // Validate all mappings against actual features
  console.log('\n🔍 Validating rebuilt mappings...');
  
  let validCount = 0;
  let invalidCount = 0;
  const invalid = [];

  // Validate CSS mappings
  for (const [prop, mapping] of Object.entries(CSS_PROPERTY_MAPPING)) {
    if (typeof mapping === 'string') {
      if (features.includes(mapping)) {
        validCount++;
      } else {
        invalidCount++;
        invalid.push(`CSS: ${prop} → ${mapping}`);
      }
    } else if (typeof mapping === 'object') {
      for (const [value, featureId] of Object.entries(mapping)) {
        if (features.includes(featureId)) {
          validCount++;
        } else {
          invalidCount++;
          invalid.push(`CSS: ${prop}:${value} → ${featureId}`);
        }
      }
    }
  }

  // Validate JS mappings
  for (const [api, featureId] of Object.entries(JS_API_MAPPING)) {
    if (features.includes(featureId)) {
      validCount++;
    } else {
      invalidCount++;
      invalid.push(`JS: ${api} → ${featureId}`);
    }
  }

  // Validate HTML mappings
  for (const [element, featureId] of Object.entries(HTML_FEATURE_MAPPING)) {
    if (features.includes(featureId)) {
      validCount++;
    } else {
      invalidCount++;
      invalid.push(`HTML: ${element} → ${featureId}`);
    }
  }

  console.log(`✅ ${validCount} valid mappings`);
  console.log(`❌ ${invalidCount} invalid mappings`);
  
  if (invalid.length > 0) {
    console.log('\nInvalid mappings that need fixing:');
    invalid.forEach(item => console.log(`   ${item}`));
  }

  // Generate the corrected feature-mappings.js file
  const fileContent = `/**
 * Feature mappings from code patterns to web-features database IDs
 * Generated by rebuild-mappings.mjs - DO NOT EDIT MANUALLY
 */

const CSS_PROPERTY_MAPPING = ${JSON.stringify(CSS_PROPERTY_MAPPING, null, 2)};

const JS_API_MAPPING = ${JSON.stringify(JS_API_MAPPING, null, 2)};

const HTML_FEATURE_MAPPING = ${JSON.stringify(HTML_FEATURE_MAPPING, null, 2)};

module.exports = {
  CSS_PROPERTY_MAPPING,
  JS_API_MAPPING, 
  HTML_FEATURE_MAPPING
};
`;

  console.log('\n💾 Writing corrected mappings to src/utils/feature-mappings.js');
  
  // Write the actual file
  const fs = await import('fs');
  await fs.promises.writeFile('/Users/sheldon/baseline/src/utils/feature-mappings.js', fileContent);
  console.log('✅ Successfully wrote corrected mappings!');
  
  console.log('File structure:');
  console.log('- CSS mappings:', Object.keys(CSS_PROPERTY_MAPPING).length, 'properties');
  console.log('- JS mappings:', Object.keys(JS_API_MAPPING).length, 'APIs');
  console.log('- HTML mappings:', Object.keys(HTML_FEATURE_MAPPING).length, 'elements');

  return { validCount, invalidCount, invalid, fileContent };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rebuildMappings().then(result => {
    console.log(`\n🎉 Rebuild complete! ${result.validCount}/${result.validCount + result.invalidCount} mappings valid`);
  });
}