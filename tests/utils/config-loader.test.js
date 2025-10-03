const ConfigLoader = require('../../src/utils/config-loader');
const core = require('@actions/core');

describe('ConfigLoader', () => {
  let configLoader;
  
  beforeEach(() => {
    configLoader = new ConfigLoader({ workingDirectory: '/test' });
    jest.clearAllMocks();
  });

  describe('Default Configuration', () => {
    it('should return default configuration when no files exist', async () => {
      // Mock file system to return "file not found"
      global.mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      const config = await configLoader.loadConfig();
      
      expect(config).toBeDefined();
      expect(config.rules.css['baseline-threshold']).toBe('newly');
      expect(config.rules.javascript['baseline-threshold']).toBe('newly');
      expect(config.rules.html['baseline-threshold']).toBe('newly');
    });

    it('should have sensible default values', async () => {
      global.mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      const config = await configLoader.loadConfig();
      
      expect(config.enforcement['max-violations']).toBe(0);
      expect(config.enforcement['severity-weights']).toEqual({
        high: 1.0,
        medium: 0.6,
        low: 0.3
      });
      expect(config.reporting['output-format']).toBe('markdown');
    });
  });

  describe('Configuration File Loading', () => {
    it.skip('should load and merge configuration from mocked file', async () => {
      const mockConfig = {
        rules: {
          css: {
            'baseline-threshold': 'widely'
          }
        }
      };

      // Set up mocks to simulate file exists and return content
      global.mockFs.access
        .mockResolvedValueOnce()  // First access check succeeds
        .mockRejectedValue(new Error('ENOENT')); // Other files don't exist
      global.mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configLoader.loadConfig();

      // Should merge with defaults
      expect(config.rules.css['baseline-threshold']).toBe('widely');
      expect(config.rules.javascript['baseline-threshold']).toBe('newly'); // Default
    });

    it('should handle missing configuration file gracefully', async () => {
      global.mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const config = await configLoader.loadConfig();

      // Should return default configuration without errors
      expect(config.rules.css['baseline-threshold']).toBe('newly');
    });

    it('should handle malformed JSON gracefully', async () => {
      global.mockFs.access.mockResolvedValue();
      global.mockFs.readFile.mockResolvedValue('{ invalid json }');

      // Should not throw but may log warnings
      const config = await configLoader.loadConfig();
      
      // Should still return valid default config
      expect(config).toBeDefined();
      expect(config.rules.css['baseline-threshold']).toBe('newly');
    });
  });

  describe('GitHub Action Inputs', () => {
    beforeEach(() => {
      // Mock core.getInput for all tests
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'baseline-threshold': 'widely',
          'max-violations': '5',
          'enforcement-mode': 'error',
          'comment-on-pr': 'true'
        };
        return inputs[name] || '';
      });
    });

    it('should load configuration from GitHub Action inputs', async () => {
      global.mockFs.access.mockRejectedValue(new Error('ENOENT')); // No config files
      
      const config = await configLoader.loadConfig();
      
      // Should use GitHub Action inputs
      expect(config.enforcement['max-violations']).toBe(5);
    });

    it('should skip empty GitHub Action inputs', async () => {
      core.getInput.mockReturnValue(''); // All inputs empty
      global.mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      const config = await configLoader.loadConfig();
      
      // Should use defaults
      expect(config.enforcement['max-violations']).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', async () => {
      const validConfig = {
        rules: {
          css: { 'baseline-threshold': 'widely' },
          javascript: { 'baseline-threshold': 'newly' },
          html: { 'baseline-threshold': 'limited' }
        },
        enforcement: {
          'max-violations': 10,
          'severity-weights': { high: 0.8, medium: 0.5, low: 0.2 }
        },
        reporting: {
          'output-format': 'markdown'
        }
      };

      // This should not throw
      expect(() => configLoader.validateConfig(validConfig)).not.toThrow();
    });

    it('should reject invalid baseline thresholds', async () => {
      const invalidConfig = {
        rules: {
          css: { 'baseline-threshold': 'invalid-threshold' }
        }
      };

      expect(() => configLoader.validateConfig(invalidConfig)).toThrow();
    });

    it('should reject invalid max violations', async () => {
      const invalidConfig = {
        enforcement: {
          'max-violations': -5
        }
      };

      expect(() => configLoader.validateConfig(invalidConfig)).toThrow();
    });

    it('should reject invalid severity weights', async () => {
      const invalidConfig = {
        enforcement: {
          'severity-weights': { high: 2.0 } // > 1.0 is invalid
        }
      };

      expect(() => configLoader.validateConfig(invalidConfig)).toThrow();
    });

    it('should reject invalid output formats', async () => {
      const invalidConfig = {
        reporting: {
          'output-format': 'xml' // Not supported
        }
      };

      expect(() => configLoader.validateConfig(invalidConfig)).toThrow();
    });
  });

  describe('Deep Merge Functionality', () => {
    it('should perform deep merge of nested objects', async () => {
      const config1 = {
        rules: {
          css: { 'baseline-threshold': 'newly', 'strict-mode': false },
          javascript: { 'baseline-threshold': 'widely' }
        }
      };
      
      const config2 = {
        rules: {
          css: { 'baseline-threshold': 'widely' }, // Should override
          html: { 'baseline-threshold': 'limited' } // Should add
        }
      };
      
      const merged = configLoader.deepMerge(config1, config2);
      
      expect(merged.rules.css['baseline-threshold']).toBe('widely');
      expect(merged.rules.css['strict-mode']).toBe(false); // Preserved
      expect(merged.rules.javascript['baseline-threshold']).toBe('widely'); // Preserved
      expect(merged.rules.html['baseline-threshold']).toBe('limited'); // Added
    });

    it('should replace arrays rather than merging them', async () => {
      const config1 = {
        enforcement: {
          'ignore-patterns': ['node_modules/**', 'dist/**']
        }
      };
      
      const config2 = {
        enforcement: {
          'ignore-patterns': ['build/**']
        }
      };
      
      const merged = configLoader.deepMerge(config1, config2);
      
      // Should replace, not merge arrays
      expect(merged.enforcement['ignore-patterns']).toEqual(['build/**']);
    });
  });

  describe('Utility Functions', () => {
    it('should generate example configuration', async () => {
      const exampleJson = configLoader.generateExampleConfig();
      
      expect(exampleJson).toBeDefined();
      expect(typeof exampleJson).toBe('string');
      
      const example = JSON.parse(exampleJson);
      expect(example.rules).toBeDefined();
      expect(example.enforcement).toBeDefined();
      expect(example.reporting).toBeDefined();
    });

    it('should set and get nested properties correctly', async () => {
      const obj = {};
      
      configLoader.setNestedProperty(obj, 'rules.css.baseline-threshold', 'widely');
      
      expect(configLoader.getNestedProperty(obj, 'rules.css.baseline-threshold')).toBe('widely');
      expect(obj.rules.css['baseline-threshold']).toBe('widely');
    });
  });

  describe('Browserslist Integration', () => {
    beforeEach(() => {
      // Ensure clean browserslist mock for each test
      const mockBrowserslist = require('browserslist');
      mockBrowserslist.mockClear();
    });

    it('should load targets from browserslist when no explicit targets exist', async () => {
      // Mock browserslist to return test data
      const mockBrowserslist = require('browserslist');
      mockBrowserslist.mockReturnValue([
        'chrome 114',
        'chrome 115', 
        'firefox 115',
        'firefox 116',
        'safari 17'
      ]);

      global.mockFs.access.mockRejectedValue(new Error('ENOENT')); // No config files
      
      const config = await configLoader.loadConfig();
      
      expect(config.targets).toEqual([
        'chrome 114',
        'chrome 115', 
        'firefox 115',
        'firefox 116',
        'safari 17'
      ]);
      expect(config.targetSource).toBe('browserslist');
    });

    it('should skip browserslist when explicit targets already exist', async () => {
      const mockBrowserslist = require('browserslist');
      mockBrowserslist.mockClear();
      
      // Test the browserslist loading logic directly with existing configs
      const existingConfigs = [
        {}, // default config
        { targets: ['chrome >= 120', 'firefox >= 120'] } // file config with targets
      ];
      
      const browserslistConfig = await configLoader.loadBrowserslistConfig(existingConfigs);
      
      // Should return null because targets already exist
      expect(browserslistConfig).toBeNull();
      expect(mockBrowserslist).not.toHaveBeenCalled();
    });

    it('should handle browserslist errors gracefully', async () => {
      const mockBrowserslist = require('browserslist');
      mockBrowserslist.mockImplementation(() => {
        throw new Error('No browserslist config found');
      });

      global.mockFs.access.mockRejectedValue(new Error('ENOENT')); // No config files
      
      const config = await configLoader.loadConfig();
      
      // Should fall back to default behavior without targets
      expect(config.targets).toBeUndefined();
      expect(config.targetSource).toBeUndefined();
    });

    it('should handle empty browserslist results', async () => {
      const mockBrowserslist = require('browserslist');
      mockBrowserslist.mockReturnValue([]);

      global.mockFs.access.mockRejectedValue(new Error('ENOENT')); // No config files
      
      const config = await configLoader.loadConfig();
      
      // Should fall back to default behavior
      expect(config.targets).toBeUndefined();
      expect(config.targetSource).toBeUndefined();
    });
  });

  describe('Official Baseline Query Detection', () => {
    it('should detect yearly baseline queries', () => {
      const queries = ['baseline 2022', 'baseline 2023', 'chrome >= 100'];
      const baselineInfo = configLoader.detectBaselineQueries(queries);
      
      expect(baselineInfo.hasBaselineQueries).toBe(true);
      expect(baselineInfo.types).toContain('yearly');
      expect(baselineInfo.years).toEqual([2022, 2023]);
      expect(baselineInfo.queries).toEqual(['baseline 2022', 'baseline 2023']);
    });

    it('should detect widely available queries', () => {
      const queries = ['baseline widely available', 'firefox >= 90'];
      const baselineInfo = configLoader.detectBaselineQueries(queries);
      
      expect(baselineInfo.hasBaselineQueries).toBe(true);
      expect(baselineInfo.types).toContain('widely');
      expect(baselineInfo.queries).toEqual(['baseline widely available']);
    });

    it('should detect newly available queries', () => {
      const queries = ['baseline newly available'];
      const baselineInfo = configLoader.detectBaselineQueries(queries);
      
      expect(baselineInfo.hasBaselineQueries).toBe(true);
      expect(baselineInfo.types).toContain('newly');
    });

    it('should detect date-specific queries', () => {
      const queries = ['baseline widely available on 2024-06-06'];
      const baselineInfo = configLoader.detectBaselineQueries(queries);
      
      expect(baselineInfo.hasBaselineQueries).toBe(true);
      expect(baselineInfo.types).toContain('widely');
      expect(baselineInfo.dates).toContain('2024-06-06');
    });

    it('should handle mixed query types', () => {
      const queries = [
        'baseline 2021',
        'baseline widely available',
        'baseline newly available',
        'chrome >= 100'
      ];
      const baselineInfo = configLoader.detectBaselineQueries(queries);
      
      expect(baselineInfo.hasBaselineQueries).toBe(true);
      expect(baselineInfo.types).toEqual(expect.arrayContaining(['yearly', 'widely', 'newly']));
      expect(baselineInfo.years).toContain(2021);
    });

    it('should return empty info for non-baseline queries', () => {
      const queries = ['chrome >= 100', 'firefox >= 90', 'safari >= 15'];
      const baselineInfo = configLoader.detectBaselineQueries(queries);
      
      expect(baselineInfo.hasBaselineQueries).toBe(false);
      expect(baselineInfo.queries).toEqual([]);
      expect(baselineInfo.types).toEqual([]);
    });

    it('should handle empty query list', () => {
      const baselineInfo = configLoader.detectBaselineQueries([]);
      
      expect(baselineInfo.hasBaselineQueries).toBe(false);
      expect(baselineInfo.queries).toEqual([]);
    });

    it('should deduplicate repeated query types', () => {
      const queries = [
        'baseline 2021',
        'baseline 2022', 
        'baseline widely available',
        'baseline widely available on 2024-01-01'
      ];
      const baselineInfo = configLoader.detectBaselineQueries(queries);
      
      expect(baselineInfo.types).toEqual(['yearly', 'widely']);
      expect(baselineInfo.years).toEqual([2021, 2022]);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      global.mockFs.access.mockRejectedValue(new Error('Permission denied'));
      
      // Should not throw, should fall back to defaults
      const config = await configLoader.loadConfig();
      expect(config).toBeDefined();
      expect(config.rules.css['baseline-threshold']).toBe('newly');
    });

    it('should handle validation errors appropriately', async () => {
      const invalidConfig = {
        rules: {
          css: { 'baseline-threshold': 'invalid' }
        }
      };
      
      expect(() => configLoader.validateConfig(invalidConfig)).toThrow(/baseline threshold/i);
    });
  });
});