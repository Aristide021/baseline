#!/usr/bin/env node

/**
 * Coverage Reality Check
 * Analyzes our actual coverage vs the full web-features database
 */

async function checkCoverageReality() {
  console.log('🔍 BASELINE COVERAGE REALITY CHECK');
  console.log('====================================');

  const webFeatures = await import('web-features');
  const allFeatures = Object.entries(webFeatures.features);
  
  // Load our current mappings
  const { 
    CSS_PROPERTY_MAPPING, 
    CSS_SELECTOR_MAPPING,
    CSS_FUNCTION_MAPPING,
    CSS_AT_RULE_MAPPING,
    JS_API_MAPPING, 
    HTML_FEATURE_MAPPING 
  } = await import('../src/utils/feature-mappings.js');

  const ourMappedFeatures = new Set();
  
  // Extract all our mapped feature IDs
  Object.values(CSS_PROPERTY_MAPPING).forEach(mapping => {
    if (typeof mapping === 'string') ourMappedFeatures.add(mapping);
    else if (typeof mapping === 'object') {
      Object.values(mapping).forEach(id => ourMappedFeatures.add(id));
    }
  });
  
  Object.values(CSS_SELECTOR_MAPPING || {}).forEach(id => ourMappedFeatures.add(id));
  Object.values(CSS_FUNCTION_MAPPING || {}).forEach(id => ourMappedFeatures.add(id));
  Object.values(CSS_AT_RULE_MAPPING || {}).forEach(id => ourMappedFeatures.add(id));
  Object.values(JS_API_MAPPING).forEach(id => id && ourMappedFeatures.add(id));
  Object.values(HTML_FEATURE_MAPPING).forEach(id => ourMappedFeatures.add(id));
  
  ourMappedFeatures.delete(null);

  // Analyze baseline status availability
  const withBaseline = allFeatures.filter(([id, feature]) => 
    feature.baseline && feature.baseline.status
  );
  
  const withoutBaseline = allFeatures.filter(([id, feature]) => 
    !feature.baseline || !feature.baseline.status
  );

  console.log('📊 DATABASE ANALYSIS:');
  console.log(`   Total features in web-features: ${allFeatures.length}`);
  console.log(`   Features WITH baseline status: ${withBaseline.length}`);
  console.log(`   Features WITHOUT baseline status: ${withoutBaseline.length}`);
  console.log(`   Baseline data coverage: ${Math.round((withBaseline.length/allFeatures.length)*100)}%`);

  // Analyze baseline status distribution
  if (withBaseline.length > 0) {
    const byStatus = {};
    const byYear = {};
    
    withBaseline.forEach(([id, feature]) => {
      const status = feature.baseline.status;
      byStatus[status] = (byStatus[status] || 0) + 1;
      
      if (feature.baseline.low_date) {
        const year = new Date(feature.baseline.low_date).getFullYear();
        byYear[year] = (byYear[year] || 0) + 1;
      }
    });

    console.log('\n📈 BASELINE STATUS DISTRIBUTION:');
    Object.entries(byStatus).forEach(([status, count]) => {
      const percentage = Math.round((count/withBaseline.length)*100);
      console.log(`   ${status}: ${count} (${percentage}%)`);
    });

    console.log('\n📅 YEARLY DISTRIBUTION (recent):');
    const recentYears = Object.keys(byYear)
      .filter(y => y >= 2020)
      .sort()
      .slice(-6);
    recentYears.forEach(year => {
      console.log(`   ${year}: ${byYear[year]} features`);
    });
  }

  // Check our coverage against baseline features
  const ourBaselineCoverage = withBaseline.filter(([id, feature]) => 
    ourMappedFeatures.has(id)
  );

  console.log('\n🎯 OUR COVERAGE ANALYSIS:');
  console.log(`   Our total mappings: ${ourMappedFeatures.size}`);
  console.log(`   Features we cover that have baseline data: ${ourBaselineCoverage.length}`);
  console.log(`   Our baseline feature coverage: ${Math.round((ourBaselineCoverage.length/withBaseline.length)*100)}%`);

  // The critical insight
  console.log('\n⚠️  CRITICAL INSIGHTS:');
  if (withBaseline.length < allFeatures.length * 0.5) {
    console.log(`   🔴 MAJOR LIMITATION: Only ${Math.round((withBaseline.length/allFeatures.length)*100)}% of features have baseline data`);
    console.log(`   🔴 This means yearly/baseline enforcement is LIMITED`);
    console.log(`   🔴 We can only do baseline enforcement for ${withBaseline.length} out of ${allFeatures.length} features`);
  }

  if (ourMappedFeatures.size > withBaseline.length) {
    console.log(`   🔴 MAPPING MISMATCH: We have ${ourMappedFeatures.size} mappings but only ${withBaseline.length} features have baseline data`);
    console.log(`   🔴 This means ${ourMappedFeatures.size - withBaseline.length} of our mappings can't use baseline enforcement`);
  }

  // Show what enforcement strategies are actually viable
  console.log('\n✅ VIABLE ENFORCEMENT STRATEGIES:');
  console.log(`   1. Per-feature: YES (works for all ${ourMappedFeatures.size} mappings)`);
  console.log(`   2. Yearly baseline: LIMITED (only ${withBaseline.length} features have dates)`);
  console.log(`   3. Category-based: YES (we can categorize any feature)`);
  console.log(`   4. Hybrid: PARTIAL (baseline part limited to ${withBaseline.length} features)`);

  console.log('\n💡 RECOMMENDATIONS:');
  console.log('   📌 Focus on per-feature and category-based enforcement');
  console.log('   📌 Use yearly baseline as supplementary, not primary strategy');
  console.log('   📌 Our 282 mappings are actually quite good coverage of actionable features');
  console.log('   📌 Not all 1,076 features are suitable for code detection anyway');

  // Check what types of features we're missing
  console.log('\n🔍 WHAT ARE WE MISSING?');
  const unmappedWithBaseline = withBaseline.filter(([id, feature]) => 
    !ourMappedFeatures.has(id)
  );
  
  console.log(`   Features with baseline data we don't map: ${unmappedWithBaseline.length}`);
  
  if (unmappedWithBaseline.length > 0) {
    console.log('\n   📋 Sample unmapped features with baseline data:');
    unmappedWithBaseline.slice(0, 10).forEach(([id, feature]) => {
      console.log(`      ${id} - "${feature.name}" (${feature.baseline.status})`);
    });
  }
}

checkCoverageReality().catch(console.error);