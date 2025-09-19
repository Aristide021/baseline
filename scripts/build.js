#!/usr/bin/env node

/**
 * Build script for the Baseline GitHub Action
 * Bundles the action using @vercel/ncc for distribution
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building Baseline GitHub Action...');

try {
  // Ensure dist directory exists
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Run ncc build
  console.log('📦 Bundling with ncc...');
  execSync('npx ncc build src/index.js -o dist --source-map --license licenses.txt', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // Copy action.yml to dist (required for GitHub Actions)
  console.log('📋 Copying action metadata...');
  const actionYml = path.join(__dirname, '..', 'action.yml');
  const distActionYml = path.join(distDir, 'action.yml');
  fs.copyFileSync(actionYml, distActionYml);

  // Create package.json for dist
  const packageJson = {
    name: '@baseline/github-action',
    version: '1.0.0',
    description: 'GitHub Action for enforcing Baseline web feature compatibility',
    main: 'index.js',
    private: true
  };
  
  fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create README for dist
  const distReadme = `# Baseline GitHub Action

This directory contains the built and bundled version of the Baseline GitHub Action.

- \`index.js\` - Main action code (bundled)
- \`action.yml\` - Action metadata
- \`licenses.txt\` - Third-party licenses

For source code and documentation, see the repository root.
`;
  
  fs.writeFileSync(path.join(distDir, 'README.md'), distReadme);

  console.log('✅ Build completed successfully!');
  console.log(`📂 Output: ${distDir}`);
  
  // Show bundle info
  const stats = fs.statSync(path.join(distDir, 'index.js'));
  const sizeInKB = Math.round(stats.size / 1024);
  console.log(`📏 Bundle size: ${sizeInKB} KB`);

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}