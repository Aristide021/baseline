#!/usr/bin/env node

/**
 * Inspect the actual web-features database to understand the correct structure
 */

async function inspectWebFeatures() {
  console.log('🔍 Inspecting web-features database structure...\n');

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.webstatus.dev/v1/features');
    const data = await response.json();
    
    console.log(`📊 Found ${data.data.length} features in database`);
    console.log('\n🔍 First 10 features:');
    
    data.data.slice(0, 10).forEach((feature, index) => {
      console.log(`${index + 1}. ID: ${feature.feature_id}`);
      console.log(`   Name: ${feature.name}`);
      console.log(`   Baseline: ${feature.baseline?.status || 'unknown'}`);
      console.log(`   Since: ${feature.baseline?.since || 'N/A'}`);
      console.log('');
    });
    
    console.log('🎨 Looking for CSS-related features:');
    const cssFeatures = data.data.filter(f => 
      f.feature_id.includes('css') || 
      f.name.toLowerCase().includes('css') ||
      f.name.toLowerCase().includes('grid') ||
      f.name.toLowerCase().includes('flex') ||
      f.name.toLowerCase().includes('container')
    );
    
    cssFeatures.slice(0, 10).forEach(feature => {
      console.log(`   • ${feature.feature_id} - "${feature.name}"`);
    });
    
    console.log('\n⚡ Looking for JavaScript-related features:');
    const jsFeatures = data.data.filter(f => 
      f.name.toLowerCase().includes('fetch') ||
      f.name.toLowerCase().includes('observer') ||
      f.name.toLowerCase().includes('api') ||
      f.name.toLowerCase().includes('worker')
    );
    
    jsFeatures.slice(0, 10).forEach(feature => {
      console.log(`   • ${feature.feature_id} - "${feature.name}"`);
    });
    
    console.log('\n📄 Looking for HTML-related features:');
    const htmlFeatures = data.data.filter(f => 
      f.name.toLowerCase().includes('html') ||
      f.name.toLowerCase().includes('element') ||
      f.name.toLowerCase().includes('dialog') ||
      f.name.toLowerCase().includes('input')
    );
    
    htmlFeatures.slice(0, 10).forEach(feature => {
      console.log(`   • ${feature.feature_id} - "${feature.name}"`);
    });
    
  } catch (error) {
    console.error('❌ Failed to inspect web-features:', error.message);
  }
}

if (require.main === module) {
  inspectWebFeatures();
}