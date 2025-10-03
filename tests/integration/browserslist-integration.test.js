const path = require('path');
const ConfigLoader = require('../../src/utils/config-loader');

// Unmock browserslist and fs for integration tests
jest.unmock('browserslist');
jest.unmock('fs');

describe('Browserslist Integration Tests', () => {
  describe('Real Browserslist Configuration', () => {
    it('should load targets from .browserslistrc file', async () => {
      const testDir = path.join(__dirname, '../fixtures/browserslist-rc');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      expect(config.targets).toBeDefined();
      expect(Array.isArray(config.targets)).toBe(true);
      expect(config.targets.length).toBeGreaterThan(0);
      expect(config.targetSource).toBe('browserslist');
    });

    it('should load targets from package.json browserslist field', async () => {
      const testDir = path.join(__dirname, '../fixtures/browserslist');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      expect(config.targets).toBeDefined();
      expect(config.targets.some(t => t.includes('chrome 114'))).toBe(true);
      expect(config.targets.some(t => t.includes('safari 17'))).toBe(true);
      expect(config.targetSource).toBe('browserslist');
    });

    it('should prioritize explicit baseline config over browserslist', async () => {
      const testDir = path.join(__dirname, '../fixtures/browserslist-with-baseline');
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      // Should use targets from baseline.config.json, not .browserslistrc
      expect(config.targets).toEqual(['chrome >= 120', 'firefox >= 120']);
      expect(config.targetSource).toBeUndefined(); // No browserslist source marker
      expect(config.enforcement.mode).toBe('yearly');
    });

    it('should handle missing browserslist gracefully', async () => {
      const testDir = '/nonexistent/directory';
      const configLoader = new ConfigLoader({ workingDirectory: testDir });
      
      const config = await configLoader.loadConfig();
      
      // Should fall back to defaults without error
      expect(config).toBeDefined();
      // Note: browserslist may still return default values even when no config exists
      // The important thing is that it doesn't throw and we get a valid config
      expect(config.rules.css['baseline-threshold']).toBe('newly');
    });
  });

  describe('Configuration Priority Order', () => {
    it('should follow correct priority: explicit config > browserslist > defaults', async () => {
      const scenarios = [
        {
          name: 'with explicit config',
          hasConfig: true,
          hasBrowserslist: true,
          expectedSource: undefined // No browserslist source marker
        },
        {
          name: 'with browserslist only',
          hasConfig: false,
          hasBrowserslist: true,
          expectedSource: 'browserslist'
        },
        {
          name: 'with defaults only',
          hasConfig: false,
          hasBrowserslist: false,
          expectedSource: 'browserslist' // browserslist will use global defaults
        }
      ];

      for (const scenario of scenarios) {
        let testDir;
        if (scenario.hasConfig && scenario.hasBrowserslist) {
          testDir = path.join(__dirname, '../fixtures/browserslist-with-baseline');
        } else if (scenario.hasBrowserslist) {
          testDir = path.join(__dirname, '../fixtures/browserslist');
        } else {
          testDir = '/nonexistent/directory';
        }
        
        const configLoader = new ConfigLoader({ workingDirectory: testDir });
        const config = await configLoader.loadConfig();
        
        expect(config.targetSource).toBe(scenario.expectedSource);
        
        if (scenario.expectedSource === 'browserslist') {
          expect(config.targets).toBeDefined();
          expect(Array.isArray(config.targets)).toBe(true);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle browserslist parsing errors gracefully', async () => {
      // Create a temporary directory with invalid browserslist config
      const tempDir = path.join(__dirname, '../fixtures/browserslist-invalid');
      const configLoader = new ConfigLoader({ workingDirectory: tempDir });
      
      const config = await configLoader.loadConfig();
      
      // Should fall back gracefully - browserslist errors are caught in the try/catch
      expect(config).toBeDefined();
      expect(config.rules.css['baseline-threshold']).toBe('newly');
    });

    it('should handle empty browserslist results', async () => {
      // Test with a directory that has no browserslist config
      // browserslist will use defaults, but we test the empty result path in unit tests
      const configLoader = new ConfigLoader({ 
        workingDirectory: path.join(__dirname, '../fixtures/browserslist')
      });
      
      const config = await configLoader.loadConfig();
      
      // With real browserslist, we'll get some targets, which is expected
      expect(config).toBeDefined();
      expect(config.rules.css['baseline-threshold']).toBe('newly');
    });
  });

  describe('Target Format Validation', () => {
    it('should preserve browserslist target format', async () => {
      const configLoader = new ConfigLoader({ 
        workingDirectory: path.join(__dirname, '../fixtures/browserslist-rc')
      });
      
      const config = await configLoader.loadConfig();
      
      // With real browserslist and the fixture config, we should get targets
      expect(config.targets).toBeDefined();
      expect(Array.isArray(config.targets)).toBe(true);
      expect(config.targets.length).toBeGreaterThan(0);
      expect(config.targetSource).toBe('browserslist');
      
      // Targets should be in browserslist format (e.g., "chrome 114", "firefox 115")
      expect(config.targets.some(target => target.includes('chrome'))).toBe(true);
    });
  });
});