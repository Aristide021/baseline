const path = require('path');
const ConfigLoader = require('../../src/utils/config-loader');
const PolicyEngine = require('../../src/engines/policy-engine');

// Unmock for integration tests
jest.unmock('browserslist');
jest.unmock('fs');

describe('Official Baseline Queries Integration', () => {
  describe('Query Detection and Parsing', () => {
    it('should detect yearly baseline queries', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-yearly');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      expect(config.baselineQueries).toBeDefined();
      expect(config.baselineQueries.hasBaselineQueries).toBe(true);
      expect(config.baselineQueries.types).toContain('yearly');
      expect(config.baselineQueries.years).toContain(2022);
      expect(config.baselineQueries.queries).toContain('baseline 2022');
    });

    it('should detect widely available queries', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-widely');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      expect(config.baselineQueries).toBeDefined();
      expect(config.baselineQueries.hasBaselineQueries).toBe(true);
      expect(config.baselineQueries.types).toContain('widely');
      expect(config.baselineQueries.queries).toContain('baseline widely available');
    });

    it('should detect newly available queries', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-newly');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      expect(config.baselineQueries).toBeDefined();
      expect(config.baselineQueries.hasBaselineQueries).toBe(true);
      expect(config.baselineQueries.types).toContain('newly');
      expect(config.baselineQueries.queries).toContain('baseline newly available');
    });

    it('should parse mixed baseline queries with dates', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-mixed');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      expect(config.baselineQueries).toBeDefined();
      expect(config.baselineQueries.hasBaselineQueries).toBe(true);
      expect(config.baselineQueries.types).toEqual(expect.arrayContaining(['yearly', 'widely']));
      expect(config.baselineQueries.years).toEqual(expect.arrayContaining([2021, 2022]));
      expect(config.baselineQueries.dates).toContain('2024-06-06');
    });
  });

  describe('Auto-Configuration Integration', () => {
    it('should auto-configure yearly enforcement for baseline year queries', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-yearly');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      const config = await configLoader.loadConfig();
      
      // Create a mock baseline data manager
      const mockBaselineDataManager = {
        getBaselineStatus: jest.fn().mockReturnValue({
          baseline: { low_date: '2022-01-01', high_date: '2023-06-01' },
          status: { support: 'newly' }
        })
      };
      
      new PolicyEngine(config, mockBaselineDataManager);
      
      expect(config.enforcement?.mode).toBe('yearly');
      expect(config.enforcement?.['baseline-query-mode']).toBe(true);
      expect(config.enforcement?.['auto-yearly-rules']).toBeDefined();
      expect(config.enforcement?.['detected-queries']).toContain('baseline 2022');
    });

    it('should auto-configure strict enforcement for widely available queries', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-widely');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      const config = await configLoader.loadConfig();
      
      const mockBaselineDataManager = {
        getBaselineStatus: jest.fn()
      };
      
      new PolicyEngine(config, mockBaselineDataManager);
      
      expect(config.enforcement?.mode).toBe('per-feature');
      expect(config.enforcement?.['baseline-threshold']).toBe('widely');
      expect(config.enforcement?.['baseline-query-mode']).toBe(true);
    });

    it('should auto-configure balanced enforcement for newly available queries', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-newly');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      const config = await configLoader.loadConfig();
      
      const mockBaselineDataManager = {
        getBaselineStatus: jest.fn()
      };
      
      new PolicyEngine(config, mockBaselineDataManager);
      
      expect(config.enforcement?.mode).toBe('per-feature');
      expect(config.enforcement?.['baseline-threshold']).toBe('newly');
      expect(config.enforcement?.['baseline-query-mode']).toBe(true);
    });
  });

  describe('Yearly Rules Generation', () => {
    it('should generate intelligent yearly rules from detected years', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-mixed');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      const config = await configLoader.loadConfig();
      
      const mockBaselineDataManager = {
        getBaselineStatus: jest.fn()
      };
      
      new PolicyEngine(config, mockBaselineDataManager);
      
      const yearlyRules = config.enforcement?.['auto-yearly-rules'];
      expect(yearlyRules).toBeDefined();
      
      // Check that 2021 and 2022 have appropriate enforcement levels
      expect(yearlyRules[2021]).toBeDefined();
      expect(yearlyRules[2022]).toBeDefined();
      
      // 2021 is 4+ years old, should be 'error'
      expect(yearlyRules[2021]).toBe('error');
      
      // 2022 is 3+ years old, should be 'error'  
      expect(yearlyRules[2022]).toBe('error');
    });

    it('should handle current and future years appropriately', async () => {
      // Create a mock config with current year
      const currentYear = new Date().getFullYear();
      const config = {
        baselineQueries: {
          hasBaselineQueries: true,
          types: ['yearly'],
          years: [currentYear - 1, currentYear],
          queries: [`baseline ${currentYear - 1}`, `baseline ${currentYear}`]
        }
      };
      
      const mockBaselineDataManager = {
        getBaselineStatus: jest.fn()
      };
      
      new PolicyEngine(config, mockBaselineDataManager);
      
      const yearlyRules = config.enforcement?.['auto-yearly-rules'];
      
      // Current year should be 'off'
      expect(yearlyRules[currentYear]).toBe('off');
      
      // Last year should be 'info'
      expect(yearlyRules[currentYear - 1]).toBe('info');
    });
  });

  describe('Browser Target Integration', () => {
    it('should maintain browser targets while adding Baseline metadata', async () => {
      const testDir = path.join(__dirname, '../fixtures/baseline-yearly');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      // Should have both browser targets and baseline metadata
      expect(config.targets).toBeDefined();
      expect(Array.isArray(config.targets)).toBe(true);
      expect(config.targets.length).toBeGreaterThan(0);
      expect(config.targetSource).toBe('browserslist');
      expect(config.baselineQueries).toBeDefined();
    });

    it('should work with non-baseline browserslist configs', async () => {
      const testDir = path.join(__dirname, '../fixtures/browserslist');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      // Should have targets but no baseline metadata
      expect(config.targets).toBeDefined();
      expect(config.targetSource).toBe('browserslist');
      expect(config.baselineQueries).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid baseline queries gracefully', async () => {
      const configLoader = new ConfigLoader({ 
        workingDirectory: '/nonexistent'
      });
      
      // This should not throw even with invalid directory
      const config = await configLoader.loadConfig();
      expect(config).toBeDefined();
    });

    it('should not break when no baseline queries detected', async () => {
      const testDir = path.join(__dirname, '../fixtures/browserslist-rc');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      const config = await configLoader.loadConfig();
      
      const mockBaselineDataManager = {
        getBaselineStatus: jest.fn()
      };
      
      // Should work normally without baseline queries
      const policyEngine = new PolicyEngine(config, mockBaselineDataManager);
      expect(policyEngine).toBeDefined();
      expect(config.enforcement?.['baseline-query-mode']).toBeUndefined();
    });
  });
});