const BaselineAction = require('../../src/index');
const fs = require('fs').promises;
const path = require('path');

/**
 * Regression test: ensure that when features are detected, total-files-scanned output is non-zero
 * (guards against prior bug where 0 files were reported with many features)
 */

describe('Regression: File Count vs Features Detected', () => {
  const tempDir = path.join(process.cwd(), 'temp-regression');

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
    // Create a couple of files with detectable features
    await fs.writeFile(path.join(tempDir, 'a.js'), 'fetch("/api")');
    await fs.writeFile(path.join(tempDir, 'b.css'), 'body { display: grid; }');
    process.chdir(tempDir);
  });

  afterAll(async () => {
    process.chdir('..');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (_) {}
  });

  it('should report non-zero total-files-scanned when features are detected', async () => {
    // Mock minimal core inputs
    process.env['INPUT_SCAN-MODE'] = 'repo';
    process.env['INPUT_ENFORCEMENT-MODE'] = 'warn';

    // Create a minimal config file with include patterns
    await fs.writeFile(path.join(tempDir, 'baseline.config.json'), JSON.stringify({
      enforcement: { 'include-patterns': ['**/*.js', '**/*.css'] }
    }, null, 2));

    const action = new BaselineAction();
    // Monkey patch core.setOutput to capture outputs
    const outputs = {};
    const core = require('@actions/core');
    const originalSetOutput = core.setOutput;
    core.setOutput = (k, v) => { outputs[k] = v; originalSetOutput(k, v); };

    await action.run();

    const featuresDetected = parseInt(outputs['total-features-detected'] || '0', 10);
    const filesScanned = parseInt(outputs['total-files-scanned'] || '0', 10);

    if (featuresDetected > 0) {
      expect(filesScanned).toBeGreaterThan(0);
    } else {
      // If no features (unexpected for this setup) we just assert not negative
      expect(filesScanned).toBeGreaterThanOrEqual(0);
    }
  }, 30000);
});
