#!/usr/bin/env node

/**
 * Integration Recommendations for CSS Feature Expansion
 * Analyzes current mappings and provides actionable integration steps
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class IntegrationRecommendations {
  constructor() {
    this.currentMappingsPath = join(__dirname, '..', 'src', 'utils', 'feature-mappings.js');
    this.researchReportPath = join(__dirname, '..', 'css-feature-research-report.json');
    this.priorityReportPath = join(__dirname, '..', 'css-implementation-priority.json');
    
    this.currentMappings = null;
    this.researchReport = null;
    this.priorityReport = null;
  }

  loadData() {
    console.log('📊 Loading existing data...');
    
    try {
      // Load current feature mappings (parse JS file)
      const currentMappingsContent = readFileSync(this.currentMappingsPath, 'utf8');
      
      // Extract current CSS property count (rough estimate)
      const cssPropertyMatches = currentMappingsContent.match(/CSS_PROPERTY_MAPPING\s*=\s*{([^}]+)}/s);
      const currentCSSProperties = cssPropertyMatches ? 
        (cssPropertyMatches[1].match(/\"/g) || []).length / 2 : 0;
      
      this.currentMappings = {
        cssProperties: currentCSSProperties,
        hasSelectors: currentMappingsContent.includes('getCSSSelectorFeature'),
        hasFunctions: currentMappingsContent.includes('getCSSFunctionFeature'),
        hasAtRules: currentMappingsContent.includes('getCSSAtRuleFeature')
      };
      
      // Load research reports
      this.researchReport = JSON.parse(readFileSync(this.researchReportPath, 'utf8'));
      this.priorityReport = JSON.parse(readFileSync(this.priorityReportPath, 'utf8'));
      
      console.log('✅ Data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load data:', error.message);
      throw error;
    }
  }

  analyzeGaps() {
    console.log('🔍 Analyzing feature gaps...');
    
    const gaps = {
      missingCSSProperties: 88 - this.currentMappings.cssProperties, // Enhanced has 88, current has ~33
      missingSelectors: this.currentMappings.hasSelectors ? 0 : 41,
      missingFunctions: this.currentMappings.hasFunctions ? 0 : 22,
      missingAtRules: this.currentMappings.hasAtRules ? 0 : 12
    };

    const highImpactMissing = this.priorityReport.implementationOrder
      .filter(feature => feature.score >= 90)
      .slice(0, 10);

    return {
      gaps,
      highImpactMissing,
      totalPotentialIncrease: gaps.missingCSSProperties + gaps.missingSelectors + gaps.missingFunctions + gaps.missingAtRules
    };
  }

  generatePhaseImplementationPlan() {
    console.log('📋 Generating phased implementation plan...');
    
    const phases = {
      phase1: {
        name: "Critical Layout & Functions (Week 1-2)",
        description: "Add the most impactful CSS features for modern layouts and responsive design",
        features: this.priorityReport.implementationOrder
          .filter(f => ['Layout', 'Functions'].includes(f.category) && f.score >= 90)
          .slice(0, 8),
        effort: "Low",
        impact: "High",
        riskLevel: "Low"
      },
      phase2: {
        name: "Modern Selectors & Properties (Week 3-4)",
        description: "Add modern CSS selectors and commonly used properties",
        features: this.priorityReport.implementationOrder
          .filter(f => ['Selectors', 'Variables'].includes(f.category) && f.score >= 80)
          .slice(0, 10),
        effort: "Medium", 
        impact: "High",
        riskLevel: "Low"
      },
      phase3: {
        name: "Responsive & Interaction Features (Week 5-6)",
        description: "Add container queries, scroll features, and interaction enhancements",
        features: this.priorityReport.implementationOrder
          .filter(f => ['Responsive', 'Interaction', 'Color'].includes(f.category))
          .slice(0, 8),
        effort: "Medium",
        impact: "Medium",
        riskLevel: "Low"
      },
      phase4: {
        name: "Advanced & Future Features (Week 7-8)",
        description: "Add cutting-edge features and comprehensive coverage",
        features: this.priorityReport.implementationOrder
          .filter(f => f.score < 80 && f.score >= 60)
          .slice(0, 15),
        effort: "High",
        impact: "Medium",
        riskLevel: "Medium"
      }
    };

    return phases;
  }

  generateImplementationCode() {
    console.log('💻 Generating implementation code snippets...');
    
    // Generate code for updating feature-mappings.js
    const phase1Features = this.priorityReport.implementationOrder
      .filter(f => ['Layout', 'Functions'].includes(f.category) && f.score >= 90)
      .slice(0, 8);

    const newPropertyMappings = {};
    const newSelectorMappings = {};
    const newFunctionMappings = {};

    // Map high-priority features to code patterns
    phase1Features.forEach(feature => {
      switch (feature.id) {
        case 'grid':
        case 'grid-animation':
          Object.assign(newPropertyMappings, {
            'grid-template-columns': 'grid',
            'grid-template-rows': 'grid', 
            'grid-template-areas': 'grid',
            'grid-column': 'grid',
            'grid-row': 'grid',
            'grid-area': 'grid'
          });
          break;
        case 'subgrid':
          newPropertyMappings['grid-template-columns'] = {
            'subgrid': 'subgrid'
          };
          break;
        case 'flexbox-gap':
          Object.assign(newPropertyMappings, {
            'gap': 'flexbox-gap',
            'column-gap': 'flexbox-gap',
            'row-gap': 'flexbox-gap'
          });
          break;
        case 'calc':
          newFunctionMappings['calc'] = 'calc';
          break;
        case 'min-max-clamp':
          Object.assign(newFunctionMappings, {
            'min': 'min-max-clamp',
            'max': 'min-max-clamp',
            'clamp': 'min-max-clamp'
          });
          break;
      }
    });

    const codeSnippets = {
      propertyMappings: `
// Add these to CSS_PROPERTY_MAPPING object:
${JSON.stringify(newPropertyMappings, null, 2).slice(1, -1)}`,
      
      functionImplementation: `
// Enhanced CSS function detection:
const CSS_FUNCTION_MAPPING = ${JSON.stringify(newFunctionMappings, null, 2)};

function getCSSFunctionFeature(functionName) {
  return CSS_FUNCTION_MAPPING[functionName] || null;
}`,

      selectorImplementation: `
// CSS selector detection (Phase 2):
const CSS_SELECTOR_MAPPING = {
  ':is': 'is',
  ':where': 'where',
  ':has': 'has',
  ':focus-visible': 'focus-visible'
};

function getCSSSelectorFeature(selector) {
  const cleanSelector = selector.trim();
  return CSS_SELECTOR_MAPPING[cleanSelector] || null;
}`
    };

    return codeSnippets;
  }

  generateTestingStrategy() {
    console.log('🧪 Generating testing strategy...');
    
    const testCases = {
      cssProperties: [
        'grid-template-columns: repeat(3, 1fr)',
        'gap: 1rem',
        'aspect-ratio: 16/9',
        'container-type: inline-size'
      ],
      cssFunctions: [
        'width: calc(100% - 2rem)',
        'font-size: clamp(1rem, 2.5vw, 2rem)',
        'margin: max(1rem, 5%)'
      ],
      cssSelectors: [
        '.card:has(img)',
        '.button:is(.primary, .secondary)',
        '.input:focus-visible'
      ]
    };

    const testingPhases = {
      unit: "Test individual feature detection functions",
      integration: "Test with real CSS files from your projects",
      regression: "Ensure existing 78 mappings still work",
      performance: "Measure impact on parsing speed"
    };

    return { testCases, testingPhases };
  }

  generateReport() {
    console.log('📝 Generating comprehensive integration report...');
    
    const analysis = this.analyzeGaps();
    const phases = this.generatePhaseImplementationPlan();
    const codeSnippets = this.generateImplementationCode();
    const testing = this.generateTestingStrategy();
    
    const report = {
      executiveSummary: {
        currentState: `${this.currentMappings.cssProperties} CSS property mappings`,
        potentialExpansion: `+${analysis.totalPotentialIncrease} new feature mappings`,
        recommendedApproach: "4-phase implementation over 8 weeks",
        expectedImpact: "3-4x increase in CSS feature coverage",
        riskAssessment: "Low risk - additive changes only"
      },
      
      currentState: {
        mappings: this.currentMappings,
        gaps: analysis.gaps,
        totalFeatures: 78, // Current count mentioned in request
        coverage: "Baseline CSS features, limited modern CSS support"
      },
      
      recommendedExpansion: {
        totalNewFeatures: analysis.totalPotentialIncrease,
        highPriorityFeatures: analysis.highImpactMissing.length,
        categories: Object.keys(this.priorityReport.categories),
        focusAreas: ["Layout (Grid/Flexbox)", "Modern Selectors", "CSS Functions", "Container Queries"]
      },
      
      implementationPlan: phases,
      
      codeExamples: codeSnippets,
      
      testingStrategy: testing,
      
      successMetrics: {
        featureCount: "From 78 to 240+ feature mappings",
        coverageIncrease: "3x improvement in CSS feature detection",
        modernFeatures: "Support for CSS Grid, Container Queries, :has(), clamp(), etc.",
        developerExperience: "Better detection of modern CSS patterns"
      },
      
      nextSteps: [
        "Review Phase 1 implementation plan and code examples",
        "Set up testing environment for new feature mappings", 
        "Begin with critical Layout and Functions features (8 features)",
        "Test against real-world CSS codebases",
        "Monitor for any regression issues",
        "Proceed to Phase 2 after validation"
      ],
      
      technicalConsiderations: {
        backwardCompatibility: "All changes are additive - no breaking changes",
        performance: "Minimal impact - same lookup patterns",
        maintenance: "Features aligned with WebStatus.dev API standards",
        documentation: "Update README with new supported features"
      }
    };

    return report;
  }

  printExecutiveSummary(report) {
    console.log('\n' + '='.repeat(100));
    console.log('🎯 CSS FEATURE EXPANSION - INTEGRATION RECOMMENDATIONS');
    console.log('='.repeat(100));
    
    console.log(`\n📊 EXECUTIVE SUMMARY:`);
    console.log(`   Current State: ${report.executiveSummary.currentState}`);
    console.log(`   Expansion Opportunity: ${report.executiveSummary.potentialExpansion}`);
    console.log(`   Recommended Approach: ${report.executiveSummary.recommendedApproach}`);
    console.log(`   Expected Impact: ${report.executiveSummary.expectedImpact}`);
    console.log(`   Risk Level: ${report.executiveSummary.riskAssessment}`);
    
    console.log(`\n🚀 PHASE 1 PRIORITIES (IMMEDIATE - Week 1-2):`);
    report.implementationPlan.phase1.features.forEach((feature, i) => {
      console.log(`   ${i + 1}. ${feature.id} - "${feature.name}" (Score: ${feature.score})`);
    });
    
    console.log(`\n📈 SUCCESS METRICS:`);
    Object.entries(report.successMetrics).forEach(([key, value]) => {
      console.log(`   ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${value}`);
    });
    
    console.log(`\n✅ IMMEDIATE NEXT STEPS:`);
    report.nextSteps.slice(0, 3).forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
    
    console.log(`\n📄 DETAILED REPORTS AVAILABLE:`);
    console.log(`   • css-feature-research-report.json - Complete feature analysis`);
    console.log(`   • css-implementation-priority.json - Priority implementation guide`);
    console.log(`   • integration-recommendations-report.json - This comprehensive plan`);
    console.log(`   • enhanced-css-mappings.js - Ready-to-use mapping code`);
    
    console.log('\n' + '='.repeat(100));
  }

  async run() {
    console.log('🚀 Generating Integration Recommendations\n');
    
    try {
      this.loadData();
      const report = this.generateReport();
      
      // Save comprehensive report
      const reportPath = join(__dirname, '..', 'integration-recommendations-report.json');
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      this.printExecutiveSummary(report);
      
      console.log(`\n✅ Integration recommendations generated successfully!`);
      console.log(`📄 Full report saved to: integration-recommendations-report.json`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Integration analysis failed:', error.message);
      throw error;
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const integration = new IntegrationRecommendations();
  integration.run()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}

export default IntegrationRecommendations;