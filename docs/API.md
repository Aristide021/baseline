# Baseline GitHub Action API Reference

This document provides detailed API documentation for the Baseline GitHub Action's core components.

## Table of Contents

- [Main Action](#main-action)
- [Feature Detectors](#feature-detectors)
- [Policy Engine](#policy-engine)
- [Report Generator](#report-generator)
- [Configuration](#configuration)
- [Types and Interfaces](#types-and-interfaces)

## Main Action

### BaselineAction

The main entry point for the GitHub Action.

```javascript
const BaselineAction = require('./src/index');

const action = new BaselineAction();
await action.run();
```

#### Methods

##### `run()`
Executes the complete Baseline compliance check workflow.

**Returns:** `Promise<void>`

**Throws:** Various errors depending on failure mode

## Feature Detectors

### CSSFeatureDetector

Detects CSS features in stylesheets.

```javascript
const CSSFeatureDetector = require('./src/detectors/css-feature-detector');

const detector = new CSSFeatureDetector(options);
```

#### Constructor Options

```typescript
interface CSSDetectorOptions {
  includeVendorPrefixes?: boolean;      // Default: true
  includeExperimentalFeatures?: boolean; // Default: true
}
```

#### Methods

##### `detectFeatures(cssContent, filePath)`
Analyzes CSS content and returns detected features.

**Parameters:**
- `cssContent` (string): CSS content to analyze
- `filePath` (string): File path for reporting

**Returns:** `Promise<Feature[]>`

**Example:**
```javascript
const features = await detector.detectFeatures(`
  .container {
    display: grid;
    container-type: inline-size;
  }
`, 'styles.css');

// Returns:
[
  {
    type: 'css-property',
    name: 'display',
    value: 'grid',
    featureId: 'css-grid',
    location: { line: 2, column: 5 },
    file: 'styles.css',
    context: { selector: '.container' }
  }
]
```

### JSFeatureDetector

Detects JavaScript features in code.

```javascript
const JSFeatureDetector = require('./src/detectors/js-feature-detector');

const detector = new JSFeatureDetector(options);
```

#### Constructor Options

```typescript
interface JSDetectorOptions {
  includeExperimentalFeatures?: boolean; // Default: true
  strictMode?: boolean;                   // Default: true
}
```

#### Methods

##### `detectFeatures(jsContent, filePath)`
Analyzes JavaScript content and returns detected features.

**Parameters:**
- `jsContent` (string): JavaScript content to analyze
- `filePath` (string): File path for reporting

**Returns:** `Promise<Feature[]>`

**Example:**
```javascript
const features = await detector.detectFeatures(`
  const data = await fetch('/api/data');
  const observer = new IntersectionObserver(callback);
`, 'script.js');

// Returns features for fetch API and IntersectionObserver
```

### HTMLFeatureDetector

Detects HTML features in markup.

```javascript
const HTMLFeatureDetector = require('./src/detectors/html-feature-detector');

const detector = new HTMLFeatureDetector(options);
```

#### Constructor Options

```typescript
interface HTMLDetectorOptions {
  includeDataAttributes?: boolean;  // Default: true
  includeAriaAttributes?: boolean;  // Default: true
  includeExperimentalFeatures?: boolean; // Default: true
}
```

#### Methods

##### `detectFeatures(htmlContent, filePath)`
Analyzes HTML content and returns detected features.

**Parameters:**
- `htmlContent` (string): HTML content to analyze
- `filePath` (string): File path for reporting

**Returns:** `Promise<Feature[]>`

## Policy Engine

### PolicyEngine

Evaluates detected features against Baseline policies.

```javascript
const PolicyEngine = require('./src/engines/policy-engine');

const engine = new PolicyEngine(config, baselineDataManager);
```

#### Constructor Parameters

- `config` (object): Policy configuration
- `baselineDataManager` (BaselineDataManager): Data manager instance

#### Methods

##### `evaluateFeatures(features)`
Evaluates features against policies and returns violations.

**Parameters:**
- `features` (Feature[]): Array of detected features

**Returns:** `Promise<Violation[]>`

**Example:**
```javascript
const violations = await engine.evaluateFeatures([
  {
    type: 'css-property',
    featureId: 'css-container-queries',
    file: 'styles.css',
    location: { line: 5, column: 3 }
  }
]);

// Returns violations if feature doesn't meet threshold
```

##### `calculateComplianceScore(allFeatures, violations)`
Calculates overall compliance score.

**Parameters:**
- `allFeatures` (Feature[]): All detected features
- `violations` (Violation[]): Policy violations

**Returns:** `number` (0-100)

##### `getViolationsSummary()`
Gets summary statistics of violations.

**Returns:** `ViolationsSummary`

```typescript
interface ViolationsSummary {
  total: number;
  byFeatureType: Record<string, number>;
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  byFile: Record<string, number>;
}
```

## Report Generator

### ReportGenerator

Generates compliance reports in various formats.

```javascript
const ReportGenerator = require('./src/utils/report-generator');

const generator = new ReportGenerator(options);
```

#### Constructor Options

```typescript
interface ReportOptions {
  includeRemediation?: boolean;        // Default: true
  groupByFeature?: boolean;           // Default: true
  showPolyfillSuggestions?: boolean;  // Default: true
  includeCompatibilityData?: boolean; // Default: true
  maxViolationsPerFile?: number;      // Default: 50
  outputFormat?: 'markdown' | 'json' | 'html'; // Default: 'markdown'
}
```

#### Methods

##### `generateReport(violations, summary, metadata)`
Generates a comprehensive report.

**Parameters:**
- `violations` (Violation[]): Policy violations
- `summary` (ViolationsSummary): Violations summary
- `metadata` (object): Additional metadata

**Returns:** `Promise<string>` (report content)

##### `generateGitHubComment(violations, summary, metadata)`
Generates content optimized for GitHub PR comments.

**Parameters:**
- `violations` (Violation[]): Policy violations
- `summary` (ViolationsSummary): Violations summary
- `metadata` (object): Additional metadata

**Returns:** `string` (comment content)

##### `saveReport(content, filePath)`
Saves report content to file.

**Parameters:**
- `content` (string): Report content
- `filePath` (string): Output file path

**Returns:** `Promise<void>`

## Configuration

### ConfigLoader

Loads and validates configuration from multiple sources.

```javascript
const ConfigLoader = require('./src/utils/config-loader');

const loader = new ConfigLoader(options);
const config = await loader.loadConfig();
```

#### Methods

##### `loadConfig()`
Loads configuration from all available sources.

**Returns:** `Promise<BaselineConfig>`

**Configuration Sources (in precedence order):**
1. Environment variables
2. GitHub Action inputs
3. package.json `baseline` field
4. Configuration file (.baseline.json)
5. Default configuration

##### `validateConfig(config)`
Validates configuration object.

**Parameters:**
- `config` (object): Configuration to validate

**Throws:** `Error` if configuration is invalid

##### `generateExampleConfig()`
Generates example configuration JSON.

**Returns:** `string` (JSON configuration)

## Types and Interfaces

### Feature

Represents a detected web platform feature.

```typescript
interface Feature {
  type: string;           // Feature type (css-property, js-api-call, etc.)
  name: string;           // Feature name
  featureId?: string;     // Baseline feature ID
  file: string;           // File path
  location: {             // Source location
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
  };
  value?: string;         // Feature value (for CSS properties)
  context?: object;       // Additional context information
}
```

### Violation

Represents a policy violation.

```typescript
interface Violation {
  feature: Feature;              // Violating feature
  currentStatus: string;         // Current Baseline status
  requiredStatus: string;        // Required Baseline status
  severity: 'high' | 'medium' | 'low'; // Violation severity
  remediation: {                 // Remediation suggestions
    polyfillSuggestions: string[];
    alternativeFeatures: string[];
    progressiveEnhancement?: object;
    estimatedAvailabilityDate?: string;
    documentation: Array<{
      title: string;
      url: string;
    }>;
    codeExamples: Array<{
      title: string;
      code: string;
      language: string;
    }>;
  };
  featureInfo?: object;          // Additional feature information
  violationId: string;           // Unique violation ID
  timestamp: string;             // Violation timestamp
}
```

### BaselineConfig

Complete configuration object structure.

```typescript
interface BaselineConfig {
  rules: {
    css: {
      'baseline-threshold': 'limited' | 'newly' | 'widely';
      'strict-mode'?: boolean;
      'allowed-exceptions'?: Exception[];
      'ignore-vendor-prefixes'?: boolean;
      'experimental-features'?: boolean;
    };
    javascript: {
      'baseline-threshold': 'limited' | 'newly' | 'widely';
      'strict-mode'?: boolean;
      'allowed-exceptions'?: Exception[];
      'polyfill-detection'?: boolean;
      'modern-syntax-only'?: boolean;
    };
    html: {
      'baseline-threshold': 'limited' | 'newly' | 'widely';
      'ignore-attributes'?: string[];
      'allowed-exceptions'?: Exception[];
      'validate-semantics'?: boolean;
    };
  };
  enforcement: {
    'max-violations'?: number;
    'fail-on-new-only'?: boolean;
    'severity-weights'?: {
      high: number;
      medium: number;
      low: number;
    };
    'ignore-patterns'?: string[];
    'include-patterns'?: string[];
  };
  reporting: {
    'include-remediation'?: boolean;
    'group-by-feature'?: boolean;
    'show-polyfill-suggestions'?: boolean;
    'include-compatibility-data'?: boolean;
    'max-violations-per-file'?: number;
    'output-format'?: 'markdown' | 'json' | 'html';
  };
  github: {
    'comment-on-pr'?: boolean;
    'update-existing-comment'?: boolean;
    'create-status-check'?: boolean;
    'status-check-name'?: string;
  };
}
```

### Exception

Configuration for allowed exceptions.

```typescript
interface Exception {
  feature?: string;      // Specific feature ID to allow
  reason?: string;       // Reason for exception
  files?: string[];      // File patterns where exception applies
}
```

## Error Handling

All async methods may throw errors. Common error types:

- `ValidationError`: Configuration or input validation failed
- `NetworkError`: API requests failed
- `FileError`: File system operations failed
- `ParserError`: Code parsing failed

Example error handling:

```javascript
try {
  const features = await detector.detectFeatures(content, filePath);
} catch (error) {
  if (error.code === 'PARSER_ERROR') {
    // Handle parsing error gracefully
    console.warn(`Failed to parse ${filePath}: ${error.message}`);
    return [];
  }
  throw error; // Re-throw other errors
}
```

## Usage Examples

### Basic Usage

```javascript
const BaselineAction = require('./src/index');

// Run complete action
const action = new BaselineAction();
await action.run();
```

### Custom Analysis

```javascript
const CSSFeatureDetector = require('./src/detectors/css-feature-detector');
const PolicyEngine = require('./src/engines/policy-engine');
const BaselineDataManager = require('./src/utils/baseline-data-manager');

// Setup
const dataManager = new BaselineDataManager();
await dataManager.initialize();

const detector = new CSSFeatureDetector();
const policyEngine = new PolicyEngine(config, dataManager);

// Analyze
const features = await detector.detectFeatures(cssContent, 'styles.css');
const violations = await policyEngine.evaluateFeatures(features);

console.log(`Found ${violations.length} violations`);
```

This API documentation covers the main components and interfaces. For more detailed examples, see the `/examples` directory in the repository.