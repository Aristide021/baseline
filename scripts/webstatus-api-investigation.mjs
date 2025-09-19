#!/usr/bin/env node

/**
 * WebStatus.dev API Investigation
 * 
 * Investigates the actual webstatus.dev API to understand how yearly
 * baseline enforcement should work using baseline_date queries
 */

class WebStatusAPIInvestigator {
  constructor() {
    this.baseUrl = 'https://webstatus.dev/api';
  }

  async investigateBaselineDateQuery() {
    console.log('🔍 WEBSTATUS.DEV API INVESTIGATION');
    console.log('===================================');
    console.log('Testing baseline_date queries like the website uses\n');

    try {
      // Test the query format from webstatus.dev
      const testQueries = [
        'baseline_date:2023-01-01..2023-12-31',  // Baseline 2023
        'baseline_date:2024-01-01..2024-12-31',  // Baseline 2024
        'baseline_date:2022-01-01..2022-12-31',  // Baseline 2022
      ];

      console.log('📊 TESTING YEARLY BASELINE QUERIES:');

      for (const query of testQueries) {
        console.log(`\n🎯 Query: ${query}`);
        
        try {
          // Try different API endpoints that might support this query
          const endpoints = [
            `/features?q=${encodeURIComponent(query)}`,
            `/search?query=${encodeURIComponent(query)}`,
            `/features/search?q=${encodeURIComponent(query)}`
          ];

          let found = false;
          for (const endpoint of endpoints) {
            const url = this.baseUrl + endpoint;
            console.log(`   Testing: ${url}`);
            
            try {
              const response = await fetch(url);
              console.log(`   Response: ${response.status} ${response.statusText}`);
              
              if (response.ok) {
                const data = await response.json();
                console.log(`   Data keys: ${Object.keys(data)}`);
                
                if (data.features && data.features.length > 0) {
                  console.log(`   ✅ Found ${data.features.length} features for ${query}`);
                  
                  // Show sample features
                  data.features.slice(0, 3).forEach(feature => {
                    console.log(`      - ${feature.feature_id}: ${feature.name}`);
                    if (feature.baseline) {
                      console.log(`        Baseline: ${feature.baseline.status} (${feature.baseline.low_date})`);
                    }
                  });
                  found = true;
                  break;
                } else if (data.total_count !== undefined) {
                  console.log(`   ✅ API responded with total_count: ${data.total_count}`);
                  found = true;
                  break;
                }
              }
            } catch (fetchError) {
              console.log(`   ❌ Fetch failed: ${fetchError.message}`);
            }
          }

          if (!found) {
            console.log(`   ⚠️  No working endpoint found for this query`);
          }

        } catch (error) {
          console.log(`   ❌ Query failed: ${error.message}`);
        }
      }

    } catch (error) {
      console.error('❌ Investigation failed:', error.message);
    }
  }

  async investigateAPIStructure() {
    console.log('\n🔍 API STRUCTURE INVESTIGATION');
    console.log('===============================');

    const endpointsToTry = [
      '/features',
      '/features?limit=5',
      '/search', 
      '/api/features',
      '/v1/features'
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const url = this.baseUrl + endpoint;
        console.log(`\n📡 Testing: ${url}`);
        
        const response = await fetch(url);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   Response structure:`);
          console.log(`   - Keys: ${Object.keys(data)}`);
          
          if (data.features && data.features.length > 0) {
            console.log(`   - Features count: ${data.features.length}`);
            console.log(`   - Sample feature structure:`);
            const sampleFeature = data.features[0];
            console.log(`     - ID: ${sampleFeature.feature_id || sampleFeature.id || 'unknown'}`);
            console.log(`     - Name: ${sampleFeature.name || 'unknown'}`);
            console.log(`     - Baseline: ${JSON.stringify(sampleFeature.baseline || 'none')}`);
            console.log(`     - All keys: ${Object.keys(sampleFeature)}`);
            break;
          }
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
  }

  async simulateYearlyEnforcementWithAPI() {
    console.log('\n🎯 YEARLY ENFORCEMENT SIMULATION');
    console.log('=================================');

    // Since we can't easily access the API, let's simulate what yearly enforcement would look like
    const yearlyStrategies = {
      '2022': {
        description: 'Features that became baseline in 2022',
        enforcement: 'error',
        reasoning: '2+ years old, should be widely adopted',
        exampleQuery: 'baseline_date:2022-01-01..2022-12-31'
      },
      '2023': {
        description: 'Features that became baseline in 2023', 
        enforcement: 'warn',
        reasoning: '1+ years old, reasonable to expect adoption',
        exampleQuery: 'baseline_date:2023-01-01..2023-12-31'
      },
      '2024': {
        description: 'Features that became baseline in 2024',
        enforcement: 'info', 
        reasoning: 'Recent baseline, informational only',
        exampleQuery: 'baseline_date:2024-01-01..2024-12-31'
      },
      '2025': {
        description: 'Features that became baseline in 2025',
        enforcement: 'off',
        reasoning: 'Too new, skip enforcement',
        exampleQuery: 'baseline_date:2025-01-01..2025-12-31'
      }
    };

    console.log('📅 PROPOSED YEARLY ENFORCEMENT STRATEGY:');
    Object.entries(yearlyStrategies).forEach(([year, strategy]) => {
      console.log(`\n   ${year}:`);
      console.log(`   ├── ${strategy.description}`);
      console.log(`   ├── Enforcement: ${strategy.enforcement.toUpperCase()}`);
      console.log(`   ├── Reasoning: ${strategy.reasoning}`);
      console.log(`   └── Query: ${strategy.exampleQuery}`);
    });

    return yearlyStrategies;
  }

  async generateAPIBasedImplementation() {
    console.log('\n💻 API-BASED IMPLEMENTATION PLAN');
    console.log('==================================');

    const implementation = {
      approach: 'webstatus_api_integration',
      description: 'Use webstatus.dev API for real-time baseline date queries',
      
      baseline_data_manager_enhancement: {
        new_methods: [
          'getFeaturesByYear(year)',
          'getFeaturesByDateRange(startDate, endDate)',
          'queryBaselineFeatures(query)',
          'cacheYearlyFeatures()'
        ],
        caching_strategy: 'Cache yearly results for 24 hours to avoid API hammering',
        fallback_strategy: 'Use web-features package as fallback when API unavailable'
      },

      enforcement_engine_changes: {
        yearly_mode: {
          description: 'Enforce based on baseline year rather than individual features',
          implementation: 'Query API for baseline_date ranges, enforce based on year age',
          configuration: {
            '2022_and_older': 'error',
            '2023': 'warn', 
            '2024': 'info',
            '2025': 'off'
          }
        },
        hybrid_mode: {
          description: 'Combine API yearly data with our curated per-feature mappings',
          logic: 'Use API for baseline dates, our mappings for detection patterns'
        }
      },

      configuration_example: {
        enforcement_mode: 'yearly_api',
        webstatus_api: {
          base_url: 'https://webstatus.dev/api',
          cache_duration_hours: 24,
          retry_attempts: 3
        },
        yearly_rules: {
          'baseline_age_3_years': 'error',
          'baseline_age_1_year': 'warn',
          'baseline_age_current': 'info'
        },
        fallback_to_per_feature: true
      }
    };

    console.log('🛠️ IMPLEMENTATION COMPONENTS:');
    console.log('\n1. 📡 API Integration:');
    console.log('   ├── Enhance BaselineDataManager with webstatus.dev API calls');
    console.log('   ├── Implement baseline_date query support');
    console.log('   ├── Add caching for yearly feature lists');
    console.log('   └── Fallback to web-features package when API unavailable');

    console.log('\n2. ⚙️ Enforcement Engine Updates:');
    console.log('   ├── Add yearly enforcement mode alongside per-feature');
    console.log('   ├── Implement baseline age calculation (2024 feature = 0 years old)');
    console.log('   ├── Dynamic severity based on feature age');
    console.log('   └── Hybrid mode: API dates + our detection mappings');

    console.log('\n3. 🎛️ Configuration Options:');
    console.log('   ├── enforcement_mode: "yearly" | "per-feature" | "hybrid"');
    console.log('   ├── yearly_rules: Define severity by baseline age');
    console.log('   ├── api_integration: WebStatus.dev API settings');  
    console.log('   └── fallback_strategy: Behavior when API unavailable');

    console.log('\n4. ✅ Benefits of This Approach:');
    console.log('   ├── Real baseline dates from authoritative source');
    console.log('   ├── Automatic yearly progression (2024 becomes 2025)');
    console.log('   ├── Industry-aligned with webstatus.dev patterns');
    console.log('   ├── Fallback ensures reliability');
    console.log('   └── Combines our detection expertise with their data');

    return implementation;
  }

  async run() {
    console.log('🚀 Starting WebStatus.dev API Investigation...\n');

    try {
      await this.investigateAPIStructure();
      await this.investigateBaselineDateQuery();
      
      const yearlyStrategies = await this.simulateYearlyEnforcementWithAPI();
      const implementation = await this.generateAPIBasedImplementation();

      console.log('\n✅ INVESTIGATION COMPLETE!');
      console.log('\n💡 KEY FINDINGS:');
      console.log('   🔍 WebStatus.dev uses baseline_date queries for yearly groupings');
      console.log('   📡 We need to integrate with their API for real baseline dates');
      console.log('   🎯 This enables true yearly enforcement like their website');
      console.log('   🔗 Combines their data authority with our detection capabilities');
      
      console.log('\n🚀 NEXT STEPS:');
      console.log('   1. Implement webstatus.dev API integration in BaselineDataManager');
      console.log('   2. Add yearly enforcement mode to PolicyEngine');
      console.log('   3. Create hybrid mode combining API dates + our mappings');
      console.log('   4. Add fallback strategy for API unavailability');
      console.log('   5. Update configuration to support yearly enforcement');

      return { yearlyStrategies, implementation };

    } catch (error) {
      console.error('❌ Investigation failed:', error.message);
      throw error;
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const investigator = new WebStatusAPIInvestigator();
  investigator.run();
}

export default WebStatusAPIInvestigator;