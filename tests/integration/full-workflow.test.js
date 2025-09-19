const path = require('path');
const fs = require('fs').promises;

// Import main components
const JSFeatureDetector = require('../../src/detectors/js-feature-detector');
const PolicyEngine = require('../../src/engines/policy-engine');
const BaselineDataManager = require('../../src/utils/baseline-data-manager');

describe('Full Workflow Integration Tests', () => {
  let jsDetector;
  let policyEngine;
  let dataManager;

  beforeAll(async () => {
    // Initialize components
    jsDetector = new JSFeatureDetector();
    dataManager = new BaselineDataManager({
      cacheDir: '.test-integration-cache'
    });
    policyEngine = new PolicyEngine({}, dataManager);
    
    await dataManager.initialize();
  });

  afterAll(async () => {
    // Clean up test cache
    try {
      await fs.rm('.test-integration-cache', { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('JavaScript Feature Detection and Policy Evaluation', () => {
    it('should detect and evaluate modern JavaScript features', async () => {
      const jsCode = `
        // Modern JavaScript features
        const fetchData = async () => {
          const response = await fetch('/api/data');
          return response.json();
        };

        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              console.log('Element is visible');
            }
          });
        });

        class MyComponent {
          constructor() {
            this.data = null;
          }
          
          async init() {
            this.data = await fetchData();
            const items = this.data?.items ?? [];
            return items.map(item => ({ ...item, processed: true }));
          }
        }
      `;

      // Step 1: Detect features
      const features = await jsDetector.detectFeatures(jsCode, 'test.js');
      
      // Verify feature detection
      expect(features.length).toBeGreaterThan(0);
      
      // Check for specific features
      const fetchFeature = features.find(f => f.featureId === 'fetch');
      expect(fetchFeature).toBeTruthy();
      expect(fetchFeature.name).toBe('fetch');
      
      const observerFeature = features.find(f => f.featureId === 'intersection-observer');
      expect(observerFeature).toBeTruthy();
      expect(observerFeature.name).toBe('IntersectionObserver');

      // Step 2: Test dual-source data architecture
      
      // Test webstatus.dev API (primary source)
      const apiFeatures = await dataManager.getAllBaselineFeatures();
      expect(apiFeatures.size).toBeGreaterThan(50); // webstatus.dev has ~100 features
      
      // Test web-features fallback
      const fallbackManager = new BaselineDataManager({ 
        apiBase: 'http://invalid-url-force-fallback',
        useWebFeaturesAsFallback: true 
      });
      await fallbackManager.initialize();
      const fallbackFeatures = await fallbackManager.getAllBaselineFeatures();
      expect(fallbackFeatures.size).toBeGreaterThan(1000); // web-features has ~1000+ features
      
      // Verify features exist in appropriate data sources
      // webstatus.dev should have newer features like ':has()'
      const hasFeature = apiFeatures.get('has');
      if (hasFeature) {
        expect(hasFeature.baseline.status).toBeTruthy();
      }
      
      // web-features should have established features like 'grid'
      const gridFeature = fallbackFeatures.get('grid');
      expect(gridFeature).toBeTruthy();
      expect(gridFeature.baseline.status).toBeTruthy();
      
      // Step 3: Evaluate policy compliance
      const config = {
        rules: {
          javascript: {
            'baseline-threshold': 'newly'
          }
        }
      };
      
      const evaluation = await policyEngine.evaluate(features, config);
      
      // Verify evaluation results
      expect(evaluation).toHaveProperty('violations');
      expect(evaluation).toHaveProperty('complianceScore');
      expect(evaluation).toHaveProperty('summary');
      
      // Compliance score should be reasonable (0-100)
      expect(evaluation.complianceScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.complianceScore).toBeLessThanOrEqual(100);
      
      console.log(`Integration Test Results:
        - Features detected: ${features.length}
        - API features available: ${apiFeatures.size}
        - Fallback features available: ${fallbackFeatures.size}
        - Compliance score: ${evaluation.complianceScore}%
        - Violations: ${evaluation.violations.length}
      `);
    }, 30000); // 30 second timeout for API calls

    it('should handle policy violations correctly', async () => {
      const jsCodeWithNewFeatures = `
        // Use features that might be "limited" baseline status
        const data = structuredClone(originalData);
        const result = await Promise.withResolvers();
      `;

      const features = await jsDetector.detectFeatures(jsCodeWithNewFeatures, 'test.js');
      
      // Test strict policy (widely supported only)
      const strictConfig = {
        rules: {
          javascript: {
            'baseline-threshold': 'widely'
          }
        }
      };
      
      const evaluation = await policyEngine.evaluate(features, strictConfig);
      
      // Should have violations for newer features
      expect(evaluation.violations).toBeDefined();
      expect(Array.isArray(evaluation.violations)).toBe(true);
      
      // Should provide remediation suggestions
      evaluation.violations.forEach(violation => {
        if (violation.remediation) {
          expect(violation.remediation).toHaveProperty('suggestions');
          expect(Array.isArray(violation.remediation.suggestions)).toBe(true);
        }
      });
    }, 30000);

    it('should provide accurate feature information', async () => {
      // Ensure baseline data is loaded first
      await dataManager.getAllBaselineFeatures();
      
      const jsCode = `
        const worker = new Worker('worker.js');
        const map = new Map();
        map.set('key', 'value');
      `;

      const features = await jsDetector.detectFeatures(jsCode, 'test.js');
      
      // Test with features that should exist in our data sources
      // Use web-features fallback for comprehensive testing
      const fallbackManager = new BaselineDataManager({ 
        apiBase: 'http://invalid-url-force-fallback',
        useWebFeaturesAsFallback: true 
      });
      await fallbackManager.initialize();
      await fallbackManager.getAllBaselineFeatures();
      
      // Verify detected features with fallback data (more comprehensive)
      for (const feature of features) {
        if (feature.featureId) {
          const baselineInfo = fallbackManager.getFeatureInfo(feature.featureId);
          if (baselineInfo) { // Some features might not be in baseline data
            expect(baselineInfo.name).toBeTruthy();
            expect(baselineInfo.baseline).toBeTruthy();
            
            const status = fallbackManager.getBaselineStatus(feature.featureId);
            expect(['limited', 'newly', 'widely', 'unknown'].includes(status)).toBe(true);
          }
        }
      }
    }, 30000);
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed JavaScript gracefully', async () => {
      const badJsCode = `
        const unclosed = {
          prop: 'value'
        // Missing closing brace
        function broken(
        // Missing closing paren
      `;

      const features = await jsDetector.detectFeatures(badJsCode, 'bad.js');
      
      // Should not throw errors, might return empty array or partial results
      expect(Array.isArray(features)).toBe(true);
    });

    it('should handle API failures gracefully', async () => {
      // Test with invalid cache to force API call
      const tempDataManager = new BaselineDataManager({
        cacheDir: '.temp-invalid-cache',
        maxRetries: 1,
        retryDelay: 100
      });

      await tempDataManager.initialize();
      
      // Should still work even if cache is empty/invalid
      const features = await tempDataManager.getAllBaselineFeatures();
      expect(features).toBeInstanceOf(Map);
      expect(features.size).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Performance and Caching', () => {
    it('should cache baseline data efficiently', async () => {
      // Test caching with both data sources
      
      // Test API caching (webstatus.dev)
      const startTime = Date.now();
      const apiFeatures1 = await dataManager.getAllBaselineFeatures();
      const firstCallTime = Date.now() - startTime;
      
      const secondStartTime = Date.now();
      const apiFeatures2 = await dataManager.getAllBaselineFeatures();
      const secondCallTime = Date.now() - secondStartTime;
      
      // Cached call should be much faster
      expect(secondCallTime).toBeLessThan(Math.max(firstCallTime / 2, 50));
      expect(apiFeatures2.size).toBe(apiFeatures1.size);
      expect(apiFeatures2.size).toBeGreaterThan(50); // webstatus.dev features
      
      // Test fallback caching (web-features)
      const fallbackManager = new BaselineDataManager({ 
        apiBase: 'http://invalid-url-force-fallback',
        useWebFeaturesAsFallback: true,
        cacheDir: '.test-fallback-cache'
      });
      await fallbackManager.initialize();
      
      const fallbackStart = Date.now();
      const fallbackFeatures1 = await fallbackManager.getAllBaselineFeatures();
      const fallbackFirstCall = Date.now() - fallbackStart;
      
      const fallbackSecondStart = Date.now();
      const fallbackFeatures2 = await fallbackManager.getAllBaselineFeatures();
      const fallbackSecondCall = Date.now() - fallbackSecondStart;
      
      // Fallback should also cache efficiently
      expect(fallbackSecondCall).toBeLessThan(Math.max(fallbackFirstCall / 2, 50));
      expect(fallbackFeatures2.size).toBe(fallbackFeatures1.size);
      expect(fallbackFeatures2.size).toBeGreaterThan(1000); // web-features has 1000+ features
    });

    it('should process large codebases efficiently', async () => {
      // Generate a large JavaScript codebase
      const largeJsCode = `
        ${Array(100).fill(0).map((_, i) => `
          const fetchData${i} = async () => {
            const response = await fetch('/api/data${i}');
            const observer${i} = new IntersectionObserver(() => {});
            const worker${i} = new Worker('worker${i}.js');
            return response.json();
          };
        `).join('\n')}
      `;

      const startTime = Date.now();
      const features = await jsDetector.detectFeatures(largeJsCode, 'large.js');
      const processingTime = Date.now() - startTime;
      
      // Should complete in reasonable time (< 5 seconds)
      expect(processingTime).toBeLessThan(5000);
      expect(features.length).toBeGreaterThan(0);
      
      console.log(`Large codebase processing: ${processingTime}ms for ${features.length} features`);
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('should handle a complete GitHub Action workflow', async () => {
      // Simulate a complete workflow like our GitHub Action would do
      
      // Step 1: Feature Detection (multiple files)
      const files = [
        {
          content: `
            import { useState, useEffect } from 'react';
            
            export default function Component() {
              const [data, setData] = useState(null);
              
              useEffect(async () => {
                const response = await fetch('/api/data');
                setData(await response.json());
              }, []);
              
              return data?.items?.map(item => (
                <div key={item.id}>{item.name}</div>
              )) ?? <div>Loading...</div>;
            }
          `,
          path: 'src/Component.jsx'
        },
        {
          content: `
            class DataService {
              async fetchUserData(userId) {
                const observer = new IntersectionObserver(() => {});
                const response = await fetch(\`/api/users/\${userId}\`);
                return response.json();
              }
              
              processData(data) {
                return data.filter(item => item.active)
                          .map(item => ({ ...item, processed: true }));
              }
            }
          `,
          path: 'src/services/DataService.js'
        }
      ];
      
      // Step 2: Detect features in all files
      const allFeatures = [];
      for (const file of files) {
        const features = await jsDetector.detectFeatures(file.content, file.path);
        allFeatures.push(...features);
      }
      
      expect(allFeatures.length).toBeGreaterThan(0);
      
      // Step 3: Policy evaluation
      const config = {
        rules: {
          javascript: {
            'baseline-threshold': 'newly'
          }
        }
      };
      
      const evaluation = await policyEngine.evaluate(allFeatures, config);
      
      // Step 4: Generate summary report
      expect(evaluation.summary).toHaveProperty('totalFeatures');
      expect(evaluation.summary).toHaveProperty('byFeatureType');
      expect(evaluation.summary).toHaveProperty('bySeverity');
      
      // Verify we have meaningful data
      expect(evaluation.summary.totalFeatures).toBeGreaterThan(0);
      
      console.log('GitHub Action Workflow Simulation Results:', {
        filesProcessed: files.length,
        featuresDetected: allFeatures.length,
        complianceScore: evaluation.complianceScore,
        violations: evaluation.violations.length
      });
    }, 30000);
  });
});