const PolicyEngine = require('../../src/engines/policy-engine');

describe('PolicyEngine', () => {
  let policyEngine;
  let mockBaselineDataManager;

  beforeEach(() => {
    // Mock BaselineDataManager
    mockBaselineDataManager = {
      getBaselineStatus: jest.fn(),
      getFeatureInfo: jest.fn()
    };

    // Default configuration
    const config = {
      rules: {
        css: {
          'baseline-threshold': 'newly',
          'allowed-exceptions': []
        },
        javascript: {
          'baseline-threshold': 'newly',
          'allowed-exceptions': []
        },
        html: {
          'baseline-threshold': 'newly',
          'allowed-exceptions': []
        }
      },
      enforcement: {
        'max-violations': 0,
        'severity-weights': {
          'high': 1.0,
          'medium': 0.6,
          'low': 0.3
        }
      }
    };

    policyEngine = new PolicyEngine(config, mockBaselineDataManager);
  });

  describe('Feature Evaluation', () => {
    it('should pass features that meet baseline threshold', async () => {
      const features = [
        {
          type: 'css-property',
          name: 'display',
          featureId: 'css-grid',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('widely');
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'CSS Grid',
        baseline: { status: 'widely' }
      });

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(0);
    });

    it('should flag features that do not meet baseline threshold', async () => {
      const features = [
        {
          type: 'css-property',
          name: 'container-type',
          featureId: 'css-container-queries',
          file: 'test.css',
          location: { line: 5, column: 3 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'CSS Container Queries',
        baseline: { status: 'limited' }
      });

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        feature: features[0],
        currentStatus: 'limited',
        requiredStatus: 'newly',
        severity: 'medium'
      });
    });

    it('should handle unknown features gracefully', async () => {
      const features = [
        {
          type: 'css-property',
          name: 'unknown-property',
          featureId: 'unknown-feature',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('unknown');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(0);
    });

    it('should skip features without featureId', async () => {
      const features = [
        {
          type: 'css-property',
          name: 'display',
          file: 'test.css',
          location: { line: 1, column: 1 }
          // Missing featureId
        }
      ];

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(0);
      expect(mockBaselineDataManager.getBaselineStatus).not.toHaveBeenCalled();
    });
  });

  describe('Threshold Logic', () => {
    beforeEach(() => {
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'Test Feature',
        baseline: { status: 'limited' }
      });
    });

    it('should correctly evaluate limited vs newly threshold', async () => {
      const features = [
        {
          type: 'css-property',
          featureId: 'test-feature',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].currentStatus).toBe('limited');
      expect(violations[0].requiredStatus).toBe('newly');
    });

    it('should correctly evaluate newly vs widely threshold', async () => {
      // Update config to require widely available features
      policyEngine.mergedConfig.rules.css['baseline-threshold'] = 'widely';

      const features = [
        {
          type: 'css-property',
          featureId: 'test-feature',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('newly');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].currentStatus).toBe('newly');
      expect(violations[0].requiredStatus).toBe('widely');
    });

    it('should pass when feature exceeds threshold', async () => {
      const features = [
        {
          type: 'css-property',
          featureId: 'test-feature',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('widely');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(0);
    });
  });

  describe('Severity Calculation', () => {
    beforeEach(() => {
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'Test Feature',
        baseline: { status: 'limited' }
      });
    });

    it('should assign high severity for large gaps', async () => {
      // Set threshold to widely, feature is limited (gap of 2)
      policyEngine.mergedConfig.rules.css['baseline-threshold'] = 'widely';

      const features = [
        {
          type: 'css-property',
          featureId: 'test-feature',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations[0].severity).toBe('high');
    });

    it('should assign medium severity for moderate gaps', async () => {
      // Threshold is newly, feature is limited (gap of 1)
      const features = [
        {
          type: 'css-property',
          featureId: 'test-feature',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations[0].severity).toBe('medium');
    });
  });

  describe('Allowed Exceptions', () => {
    it('should allow exceptions based on feature ID', async () => {
      // Add exception for specific feature
      policyEngine.mergedConfig.rules.css['allowed-exceptions'] = [
        {
          feature: 'css-container-queries',
          reason: 'Progressive enhancement implemented'
        }
      ];

      const features = [
        {
          type: 'css-property',
          featureId: 'css-container-queries',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(0);
    });

    it('should allow exceptions based on file patterns', async () => {
      // Add exception for specific file patterns
      policyEngine.mergedConfig.rules.css['allowed-exceptions'] = [
        {
          files: ['src/experimental/**'],
          reason: 'Experimental code allowed'
        }
      ];

      const features = [
        {
          type: 'css-property',
          featureId: 'css-container-queries',
          file: 'src/experimental/new-layout.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(0);
    });

    it('should not allow exceptions that do not match criteria', async () => {
      policyEngine.mergedConfig.rules.css['allowed-exceptions'] = [
        {
          feature: 'css-grid',
          files: ['src/old/**']
        }
      ];

      const features = [
        {
          type: 'css-property',
          featureId: 'css-container-queries', // Different feature
          file: 'src/new/layout.css', // Different path
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations).toHaveLength(1);
    });
  });

  describe('Remediation Generation', () => {
    it('should generate polyfill suggestions', async () => {
      const features = [
        {
          type: 'js-api-call',
          featureId: 'fetch-api',
          file: 'test.js',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'Fetch API',
        baseline: { status: 'limited' }
      });

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations[0].remediation.polyfillSuggestions).toContain('whatwg-fetch');
    });

    it('should generate alternative feature suggestions', async () => {
      const features = [
        {
          type: 'css-property',
          featureId: 'css-grid',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'CSS Grid',
        baseline: { status: 'limited' }
      });

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations[0].remediation.alternativeFeatures).toContain('css-flexbox');
    });

    it('should generate progressive enhancement suggestions', async () => {
      const features = [
        {
          type: 'css-property',
          featureId: 'css-grid',
          file: 'test.css',
          location: { line: 1, column: 1 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'CSS Grid',
        baseline: { status: 'limited' }
      });

      const violations = await policyEngine.evaluateFeatures(features);
      
      expect(violations[0].remediation.progressiveEnhancement).toBeDefined();
      expect(violations[0].remediation.progressiveEnhancement.approach).toBe('Feature Detection');
    });
  });

  describe('Compliance Score Calculation', () => {
    it('should calculate correct compliance score with no violations', () => {
      const allFeatures = [
        { featureId: 'css-grid' },
        { featureId: 'css-flexbox' }
      ];
      const violations = [];

      const score = policyEngine.calculateComplianceScore(allFeatures, violations);
      
      expect(score).toBe(100);
    });

    it('should calculate correct compliance score with violations', () => {
      const allFeatures = [
        { featureId: 'css-grid' },
        { featureId: 'css-flexbox' },
        { featureId: 'css-container-queries' },
        { featureId: 'fetch-api' }
      ];
      const violations = [
        { severity: 'high' },
        { severity: 'medium' }
      ];

      const score = policyEngine.calculateComplianceScore(allFeatures, violations);
      
      // With severity weights: high=1.0, medium=0.6
      // Total violation weight = 1.0 + 0.6 = 1.6
      // Score = (1 - 1.6/4) * 100 = 60
      expect(score).toBe(60);
    });

    it('should handle empty feature list', () => {
      const score = policyEngine.calculateComplianceScore([], []);
      expect(score).toBe(100);
    });
  });

  describe('Violations Summary', () => {
    it('should generate correct violations summary', async () => {
      const features = [
        {
          type: 'css-property',
          featureId: 'css-container-queries',
          file: 'styles.css',
          location: { line: 1, column: 1 }
        },
        {
          type: 'js-api-call',
          featureId: 'fetch-api',
          file: 'script.js',
          location: { line: 5, column: 10 }
        }
      ];

      mockBaselineDataManager.getBaselineStatus.mockReturnValue('limited');
      mockBaselineDataManager.getFeatureInfo.mockReturnValue({
        name: 'Test Feature',
        baseline: { status: 'limited' }
      });

      await policyEngine.evaluateFeatures(features);
      const summary = policyEngine.getViolationsSummary();

      expect(summary).toMatchObject({
        total: 2,
        byFeatureType: {
          css: 1,
          javascript: 1
        },
        bySeverity: {
          high: 0,
          medium: 2,
          low: 0
        },
        byFile: {
          'styles.css': 1,
          'script.js': 1
        }
      });
    });
  });

  describe('Configuration Merging', () => {
    it('should correctly merge default and user configuration', () => {
      const userConfig = {
        rules: {
          css: {
            'baseline-threshold': 'widely'
          }
        },
        enforcement: {
          'max-violations': 5
        }
      };

      const engine = new PolicyEngine(userConfig, mockBaselineDataManager);
      
      expect(engine.mergedConfig.rules.css['baseline-threshold']).toBe('widely');
      expect(engine.mergedConfig.rules.javascript['baseline-threshold']).toBe('newly'); // Default
      expect(engine.mergedConfig.enforcement['max-violations']).toBe(5);
    });
  });
});