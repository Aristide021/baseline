/**
 * SARIF (Static Analysis Results Interchange Format) formatter
 * Generates SARIF v2.1.0 output for GitHub Advanced Security integration
 */

const SARIF_VERSION = '2.1.0';
const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

/**
 * Generate SARIF output from policy violations
 * @param {Array} violations - Array of policy violations
 * @param {Object} metadata - Metadata about the run
 * @returns {string} SARIF JSON string
 */
function generateSarif(violations, metadata = {}) {
  const rules = collectRules(violations);
  const results = violations.map(violation => createResult(violation));

  const sarifLog = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: 'baseline-github-action',
            semanticVersion: metadata.version || '1.0.0',
            informationUri: 'https://github.com/Aristide021/baseline',
            shortDescription: {
              text: 'First GitHub Action to support official Baseline queries with zero-config auto-setup'
            },
            fullDescription: {
              text: 'Enforce web platform feature compatibility standards in CI/CD with official Baseline queries support'
            },
            rules
          }
        },
        results,
        properties: {
          baselineQueries: metadata.baselineQueries || [],
          autoConfigured: metadata.autoConfigured || false,
          enforcementMode: metadata.enforcementMode || 'per-feature'
        }
      }
    ]
  };

  return JSON.stringify(sarifLog, null, 2);
}

/**
 * Collect unique rules from violations
 * @param {Array} violations - Array of violations
 * @returns {Array} Array of SARIF rule objects
 */
function collectRules(violations) {
  const ruleMap = new Map();
  
  for (const violation of violations) {
    const ruleId = createRuleId(violation);
    if (!ruleMap.has(ruleId)) {
      ruleMap.set(ruleId, createRule(violation));
    }
  }
  
  return Array.from(ruleMap.values());
}

/**
 * Create a SARIF rule object
 * @param {Object} violation - Policy violation
 * @returns {Object} SARIF rule object
 */
function createRule(violation) {
  const level = mapSeverityToLevel(violation.severity);
  const category = violation.baseline || violation.featureType || 'compatibility';
  
  return {
    id: createRuleId(violation),
    name: violation.featureName || violation.feature,
    shortDescription: {
      text: `${violation.featureName || violation.feature} compatibility check`
    },
    fullDescription: {
      text: violation.guidance || `Check compatibility for ${violation.featureName || violation.feature}`
    },
    defaultConfiguration: {
      level: level
    },
    properties: {
      category: capitalize(category),
      baseline: violation.baseline,
      featureId: violation.featureId || violation.feature,
      enforcementLevel: violation.severity,
      tags: [
        'baseline',
        'compatibility',
        violation.baseline || 'unknown'
      ].filter(Boolean)
    },
    helpUri: violation.helpUrl || 'https://web.dev/baseline/'
  };
}

/**
 * Create a SARIF result object from a violation
 * @param {Object} violation - Policy violation
 * @returns {Object} SARIF result object
 */
function createResult(violation) {
  const level = mapSeverityToLevel(violation.severity);
  const message = createMessage(violation);
  
  const result = {
    ruleId: createRuleId(violation),
    level: level,
    message: {
      text: message
    },
    properties: {
      baseline: violation.baseline,
      featureId: violation.featureId || violation.feature,
      severity: violation.severity,
      enforcementRule: violation.rule
    }
  };

  // Add location if available
  if (violation.file) {
    result.locations = [createLocation(violation)];
  }

  return result;
}

/**
 * Create a SARIF location object
 * @param {Object} violation - Policy violation
 * @returns {Object} SARIF location object
 */
function createLocation(violation) {
  const location = {
    physicalLocation: {
      artifactLocation: {
        uri: normalizePath(violation.file)
      }
    }
  };

  // Add region if line/column info is available
  if (violation.line || violation.column) {
    const region = {};
    
    if (violation.line) {
      region.startLine = violation.line;
      region.endLine = violation.line;
    }
    
    if (violation.column) {
      region.startColumn = violation.column;
      region.endColumn = violation.column;
    }
    
    if (Object.keys(region).length > 0) {
      location.physicalLocation.region = region;
    }
  }

  return location;
}

/**
 * Create a rule ID for a violation
 * @param {Object} violation - Policy violation
 * @returns {string} Rule ID
 */
function createRuleId(violation) {
  const featureId = violation.featureId || violation.feature?.featureId || violation.feature || 'unknown';
  return `baseline/${featureId}`;
}

/**
 * Map violation severity to SARIF level
 * @param {string} severity - Violation severity
 * @returns {string} SARIF level
 */
function mapSeverityToLevel(severity) {
  switch (severity?.toLowerCase()) {
  case 'error':
  case 'limited':
    return 'error';
  case 'warning':
  case 'warn':
  case 'newly':
    return 'warning';
  case 'info':
  case 'note':
  case 'widely':
    return 'note';
  default:
    return 'warning';
  }
}

/**
 * Create a human-readable message for the violation
 * @param {Object} violation - Policy violation
 * @returns {string} Message text
 */
function createMessage(violation) {
  const feature = violation.featureName || violation.feature;
  const baseline = violation.baseline || 'unknown baseline status';
  const guidance = violation.guidance || '';
  
  let message = `${feature} is ${baseline}`;
  
  if (guidance) {
    message += `: ${guidance}`;
  }
  
  return message;
}

/**
 * Normalize file path for SARIF (use forward slashes)
 * @param {string} filePath - File path
 * @returns {string} Normalized path
 */
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  generateSarif,
  collectRules,
  createRule,
  createResult,
  createLocation,
  mapSeverityToLevel
};