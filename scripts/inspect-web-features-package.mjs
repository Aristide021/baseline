#!/usr/bin/env node

/**
 * Inspect the actual web-features package to understand correct feature IDs
 */

async function inspectWebFeaturesPackage() {
  console.log('🔍 Inspecting web-features package data...\n');

  const webFeatures = await import('web-features');
  console.log('Debug - webFeatures structure:', Object.keys(webFeatures));
  
  // Access the features object from the web-features package
  const featuresData = webFeatures.features;
  const features = Object.keys(featuresData);
  console.log(`📊 Found ${features.length} features in web-features package`);
  
  console.log('\n🔍 First 20 feature IDs:');
  features.slice(0, 20).forEach((id, index) => {
    const feature = featuresData[id];
    console.log(`${index + 1}. ${id} - "${feature.name}"`);
    console.log(`   Baseline: ${feature.status?.baseline || 'unknown'}`);
  });
  
  console.log('\n🎨 CSS-related features:');
  const cssFeatures = features.filter(id => {
    const feature = featuresData[id];
    return id.includes('css') || 
           feature.name.toLowerCase().includes('css') ||
           feature.name.toLowerCase().includes('grid') ||
           feature.name.toLowerCase().includes('flex') ||
           feature.name.toLowerCase().includes('container');
  });
  
  cssFeatures.slice(0, 15).forEach(id => {
    console.log(`   • ${id} - "${featuresData[id].name}"`);
  });
  
  console.log('\n⚡ JavaScript API features:');
  const jsFeatures = features.filter(id => {
    const feature = featuresData[id];
    return feature.name.toLowerCase().includes('fetch') ||
           feature.name.toLowerCase().includes('observer') ||
           feature.name.toLowerCase().includes('worker') ||
           id.includes('api');
  });
  
  jsFeatures.slice(0, 15).forEach(id => {
    console.log(`   • ${id} - "${featuresData[id].name}"`);
  });
  
  console.log('\n📄 HTML element features:');
  const htmlFeatures = features.filter(id => {
    const feature = featuresData[id];
    return feature.name.toLowerCase().includes('element') ||
           feature.name.toLowerCase().includes('html') ||
           feature.name.toLowerCase().includes('input') ||
           feature.name.toLowerCase().includes('dialog');
  });
  
  htmlFeatures.slice(0, 15).forEach(id => {
    console.log(`   • ${id} - "${featuresData[id].name}"`);
  });

  // Look for specific features we're trying to map
  console.log('\n🔎 Looking for specific features we need:');
  
  const searchTerms = ['grid', 'container', 'fetch', 'dialog', 'observer'];
  searchTerms.forEach(term => {
    console.log(`\n--- Features matching "${term}" ---`);
    const matches = features.filter(id => {
      const feature = featuresData[id];
      return id.includes(term) || feature.name.toLowerCase().includes(term);
    });
    
    matches.slice(0, 5).forEach(id => {
      console.log(`   • ${id} - "${featuresData[id].name}"`);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  inspectWebFeaturesPackage();
}