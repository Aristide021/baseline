const fs = require('fs');
const path = require('path');
const PolicyEngine = require('../../src/engines/policy-engine');

// Minimal mock for BaselineDataManager
class MockBaselineDataManager {
  getFeatureInfo(id) {
    if (id === 'backdrop-filter') {
      return { id, baseline: { status: 'newly' } };
    }
    return null;
  }
  getBaselineStatus(id) {
    return id === 'backdrop-filter' ? 'newly' : 'unknown';
  }
}

describe('Passing config exceptions', () => {
  test('backdrop-filter exception should suppress violation in passing config', async () => {
    const configPath = path.join(process.cwd(), '.baseline.passing.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const engine = new PolicyEngine(config, new MockBaselineDataManager());

    const feature = {
      featureId: 'backdrop-filter',
      type: 'css-property',
      file: 'index.html:inline-css',
      currentStatus: 'newly'
    };

    const violations = await engine.evaluateFeatures([feature]);
    expect(violations.length).toBe(0);
  });
});
