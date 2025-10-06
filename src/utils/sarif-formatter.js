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
  const featureInfo = violation.featureInfo || {};
  const featureName = featureInfo.name || violation.feature?.featureId || violation.featureId || 'unknown-feature';
  
  // Build comprehensive description
  const statusTransition = violation.currentStatus && violation.requiredStatus 
    ? ` (${violation.currentStatus} → ${violation.requiredStatus} required)`
    : '';
  
  const description = featureInfo.description || 
    `The ${featureName} feature requires ${violation.requiredStatus || 'higher'} baseline compatibility${statusTransition}`;
    
  // Extract documentation URLs
  const helpUris = [];
  if (featureInfo.spec?.links?.length > 0) {
    helpUris.push(...featureInfo.spec.links.map(link => link.link));
  }
  if (featureInfo.mdn_url) {
    helpUris.push(featureInfo.mdn_url);
  }
  helpUris.push('https://web.dev/baseline/');
  
  const rule = {
    id: createRuleId(violation),
    name: `baseline-${featureName}`,
    shortDescription: {
      text: `Baseline compatibility: ${featureName}${statusTransition}`
    },
    fullDescription: {
      text: description
    },
    defaultConfiguration: {
      level: level
    },
    properties: {
      category: 'Baseline Compatibility',
      baseline: {
        current: violation.currentStatus,
        required: violation.requiredStatus,
        status: featureInfo.baseline?.status,
        lowDate: featureInfo.baseline?.low_date,
        highDate: featureInfo.baseline?.high_date
      },
      featureId: featureName,
      enforcementLevel: violation.severity,
      tags: [
        'baseline',
        'compatibility',
        'web-platform',
        violation.currentStatus,
        violation.feature?.type || 'unknown-type'
      ].filter(Boolean),
      usage: featureInfo.usage || {}
    },
    helpUri: helpUris[0] || 'https://web.dev/baseline/',
    help: {
      text: `Learn more about ${featureName} baseline compatibility`,
      markdown: createHelpMarkdown(violation, helpUris)
    }
  };
  
  // Add relationship to specification if available
  if (helpUris.length > 1) {
    rule.relationships = helpUris.slice(1).map(uri => ({
      target: {
        id: 'documentation',
        uri: uri
      },
      kinds: ['relevant']
    }));
  }
  
  return rule;
}

/**
 * Create a SARIF result object from a violation
 * @param {Object} violation - Policy violation
 * @returns {Object} SARIF result object
 */
function createResult(violation) {
  const level = mapSeverityToLevel(violation.severity);
  const featureInfo = violation.featureInfo || {};
  const feature = violation.feature || {};
  
  // Enhanced message with baseline transition
  const statusTransition = violation.currentStatus && violation.requiredStatus 
    ? ` (${violation.currentStatus} → ${violation.requiredStatus} required)`
    : '';
  const featureName = featureInfo.name || feature.featureId || violation.featureId || 'unknown';
  
  const message = {
    text: `Baseline violation: ${featureName}${statusTransition}`,
    markdown: createResultMarkdown(violation)
  };
  
  const result = {
    ruleId: createRuleId(violation),
    level: level,
    message: message,
    properties: {
      baseline: {
        current: violation.currentStatus,
        required: violation.requiredStatus,
        status: featureInfo.baseline?.status,
        lowDate: featureInfo.baseline?.low_date,
        highDate: featureInfo.baseline?.high_date
      },
      featureId: featureName,
      severity: violation.severity,
      violationId: violation.violationId,
      timestamp: violation.timestamp,
      context: feature.context || {},
      usage: featureInfo.usage || {}
    }
  };

  // Add location if available
  if (violation.feature?.file) {
    result.locations = [createLocation(violation)];
  }
  
  // Add code flow if we have context
  if (feature.context) {
    result.codeFlows = [createCodeFlow(violation)];
  }
  
  // Add fixes if we have remediation suggestions
  if (violation.remediation) {
    const fixes = createFixes(violation);
    if (fixes.length > 0) {
      result.fixes = fixes;
    }
  }

  return result;
}

/**
 * Create a SARIF location object
 * @param {Object} violation - Policy violation
 * @returns {Object} SARIF location object
 */
function createLocation(violation) {
  const feature = violation.feature || {};
  const loc = feature.location || {};
  
  const location = {
    physicalLocation: {
      artifactLocation: {
        uri: normalizePath(feature.file || violation.file)
      }
    }
  };

  // Add region if line/column info is available
  const region = {};
  
  if (loc.line) {
    region.startLine = loc.line;
    region.endLine = loc.endLine || loc.line;
  }
  
  if (loc.column) {
    region.startColumn = loc.column;
    region.endColumn = loc.endColumn || loc.column;
  }
  
  // Add snippet if we have context
  if (feature.context && (feature.context.value || feature.context.property)) {
    region.snippet = {
      text: feature.context.value || `${feature.context.property}: ${feature.context.value || '...'}`
    };
  }
  
  if (Object.keys(region).length > 0) {
    location.physicalLocation.region = region;
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
 * Create help markdown for a rule
 * @param {Object} violation - Policy violation  
 * @param {Array} helpUris - Array of help URIs
 * @returns {string} Markdown help text
 */
function createHelpMarkdown(violation, helpUris) {
  const featureInfo = violation.featureInfo || {};
  const featureName = featureInfo.name || violation.feature?.featureId || 'this feature';
  
  let markdown = `## ${featureName}\n\n`;
  
  if (violation.currentStatus && violation.requiredStatus) {
    markdown += `**Status**: ${violation.currentStatus} → ${violation.requiredStatus} required\n\n`;
  }
  
  if (featureInfo.description) {
    markdown += `${featureInfo.description}\n\n`;
  }
  
  if (featureInfo.baseline?.low_date) {
    markdown += `**Baseline since**: ${featureInfo.baseline.low_date}\n\n`;
  }
  
  if (helpUris.length > 0) {
    markdown += '**Resources**:\n';
    helpUris.forEach(uri => {
      const linkText = uri.includes('mdn') ? 'MDN Documentation' : 
        uri.includes('spec') ? 'Specification' : 
          uri.includes('web.dev') ? 'Baseline Guide' : 'Learn More';
      markdown += `- [${linkText}](${uri})\n`;
    });
  }
  
  return markdown;
}

/**
 * Create result markdown for enhanced violation details
 * @param {Object} violation - Policy violation
 * @returns {string} Markdown content
 */
function createResultMarkdown(violation) {
  const featureInfo = violation.featureInfo || {};
  const feature = violation.feature || {};
  const featureName = featureInfo.name || feature.featureId || 'unknown';
  
  let markdown = `**${featureName}** requires ${violation.requiredStatus || 'higher'} baseline compatibility\n\n`;
  
  if (feature.context) {
    markdown += `**Usage**: \`${feature.context.property}: ${feature.context.value}\`\n\n`;
  }
  
  if (violation.remediation?.codeExamples?.length > 0) {
    markdown += `**Alternative approach**:\n\n\`\`\`css\n${violation.remediation.codeExamples[0].code}\n\`\`\`\n\n`;
  }
  
  return markdown;
}

/**
 * Create code flow for SARIF
 * @param {Object} violation - Policy violation
 * @returns {Object} SARIF code flow
 */
function createCodeFlow(violation) {
  const feature = violation.feature || {};
  const context = feature.context || {};
  
  return {
    message: {
      text: `${context.property || 'Feature'} usage detected`
    },
    threadFlows: [{
      locations: [{
        location: createLocation(violation),
        state: {
          [context.property || 'property']: context.value || 'detected'
        }
      }]
    }]
  };
}

/**
 * Create fixes for SARIF
 * @param {Object} violation - Policy violation
 * @returns {Array} SARIF fixes
 */
function createFixes(violation) {
  const fixes = [];
  const remediation = violation.remediation || {};
  
  if (remediation.codeExamples?.length > 0) {
    const example = remediation.codeExamples[0];
    if (example.code) {
      fixes.push({
        description: {
          text: `Use feature query for ${violation.featureInfo?.name || 'compatibility'}`
        },
        artifactChanges: [{
          artifactLocation: {
            uri: violation.feature?.file || 'unknown'
          },
          replacements: [{
            deletedRegion: createLocation(violation).physicalLocation.region,
            insertedContent: {
              text: example.code
            }
          }]
        }]
      });
    }
  }
  
  return fixes;
}

/**
 * Normalize file path for SARIF (use forward slashes)
 * @param {string} filePath - File path
 * @returns {string} Normalized path
 */
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}


module.exports = {
  generateSarif,
  collectRules,
  createRule,
  createResult,
  createLocation,
  mapSeverityToLevel,
  createHelpMarkdown,
  createResultMarkdown,
  createCodeFlow,
  createFixes
};