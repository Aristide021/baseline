const fs = require('fs').promises;
const path = require('path');
const core = require('@actions/core');
const { generateSarif } = require('./sarif-formatter');

/**
 * Generates detailed reports for Baseline compliance violations
 */
class ReportGenerator {
  constructor(options = {}) {
    this.options = {
      includeRemediation: options.includeRemediation !== false,
      groupByFeature: options.groupByFeature !== false,
      showPolyfillSuggestions: options.showPolyfillSuggestions !== false,
      includeCompatibilityData: options.includeCompatibilityData !== false,
      includeSummaryCharts: options.includeSummaryCharts !== false,
      maxViolationsPerFile: options.maxViolationsPerFile || 50,
      outputFormat: options.outputFormat || 'markdown',
      ...options
    };
  }

  /**
   * Generate a comprehensive report for violations
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<string>} Generated report content
   */
  async generateReport(violations, summary, metadata = {}) {
    const reportData = {
      violations,
      summary,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalFeatures: metadata.totalFeatures || 0,
        complianceScore: metadata.complianceScore || 0,
        baseline: metadata.baseline || {},
        ...metadata
      }
    };

    switch (this.options.outputFormat) {
    case 'markdown':
      return this.generateMarkdownReport(reportData);
    case 'json':
      return this.generateJSONReport(reportData);
    case 'sarif':
      return this.generateSARIFReport(reportData);
    case 'html':
      return this.generateHTMLReport(reportData);
    default:
      return this.generateMarkdownReport(reportData);
    }
  }

  /**
   * Generate markdown report
   * @param {Object} reportData - Report data
   * @returns {string} Markdown report
   */
  generateMarkdownReport(reportData) {
    const { violations, summary, metadata } = reportData;

    if (violations.length === 0) {
      return this.generateSuccessMarkdown(metadata);
    }

    let report = this.generateMarkdownHeader(summary, metadata);
    report += this.generateMarkdownSummary(summary, metadata);
    
    if (this.options.groupByFeature) {
      report += this.generateMarkdownByFeature(violations);
    } else {
      report += this.generateMarkdownByFile(violations);
    }
    
    if (this.options.includeRemediation) {
      report += this.generateMarkdownRemediation(violations);
    }
    
    report += this.generateMarkdownFooter(metadata);
    
    return report;
  }

  /**
   * Generate success markdown when no violations found
   * @param {Object} metadata - Report metadata
   * @returns {string} Success markdown
   */
  generateSuccessMarkdown(metadata) {
    return `<!-- baseline-comment -->
## ✅ Baseline Compliance Check Passed

All detected web platform features meet your Baseline requirements.

### Summary
- **Total Features Analyzed**: ${metadata.totalFeatures || 0}
- **Compliance Score**: ${metadata.complianceScore || 100}%
- **Baseline Threshold**: ${metadata.baseline.threshold || 'newly'}
- **Analysis Time**: ${new Date(metadata.generatedAt).toLocaleString()}

Your code successfully meets the Baseline compatibility standards! 🎉
`;
  }

  /**
   * Generate markdown header
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Report metadata
   * @returns {string} Markdown header
   */
  generateMarkdownHeader(summary, _metadata) {
    const totalViolations = summary.total;
    
    return `<!-- baseline-comment -->
## ${totalViolations > 0 ? '❌' : '✅'} Baseline Compliance Check

Found **${totalViolations}** feature${totalViolations !== 1 ? 's' : ''} that don't meet your Baseline threshold.

`;
  }

  /**
   * Generate markdown summary section
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Report metadata
   * @returns {string} Markdown summary
   */
  generateMarkdownSummary(summary, metadata) {
    let summaryMd = `### 📊 Summary

| Metric | Value |
|--------|-------|
| **Total Violations** | ${summary.total} |
| **Compliance Score** | ${metadata.complianceScore || 0}% |
| **High Severity** | ${summary.bySeverity.high} 🚨 |
| **Medium Severity** | ${summary.bySeverity.medium} ⚠️ |
| **Low Severity** | ${summary.bySeverity.low} 💡 |
| **Baseline Threshold** | ${metadata.baseline.threshold || 'newly'} |

#### Violations by Feature Type
| Feature Type | Count | Percentage |
|--------------|-------|------------|`;

    for (const [type, count] of Object.entries(summary.byFeatureType)) {
      const percentage = Math.round((count / summary.total) * 100);
      summaryMd += `\n| ${this.capitalizeFirst(type)} | ${count} | ${percentage}% |`;
    }

    summaryMd += '\n\n';
    return summaryMd;
  }

  /**
   * Generate violations grouped by feature
   * @param {Array} violations - Array of violations
   * @returns {string} Markdown content
   */
  generateMarkdownByFeature(violations) {
    let content = `### 🔍 Violations by Feature

`;

    // Group violations by feature ID
    const byFeature = this.groupBy(violations, v => v.feature.featureId);
    
    for (const [featureId, featureViolations] of Object.entries(byFeature)) {
      const firstViolation = featureViolations[0];
      const featureInfo = firstViolation.featureInfo;
      
      content += `#### ${featureInfo?.name || featureId}
      
- **Feature ID**: \`${featureId}\`
- **Current Status**: ${this.formatBaselineStatus(firstViolation.currentStatus)}
- **Required Status**: ${this.formatBaselineStatus(firstViolation.requiredStatus)}
- **Occurrences**: ${featureViolations.length}
- **Severity**: ${this.formatSeverity(firstViolation.severity)}

`;

      if (featureInfo?.description) {
        content += `**Description**: ${featureInfo.description}\n\n`;
      }

      // List all occurrences
      content += '**Found in:**\n';
      for (const violation of featureViolations.slice(0, 10)) { // Limit to 10 occurrences
        const loc = violation.feature.location;
        content += `- \`${violation.feature.file}\` (line ${loc.line}, column ${loc.column})\n`;
      }
      
      if (featureViolations.length > 10) {
        content += `- ... and ${featureViolations.length - 10} more occurrences\n`;
      }
      
      content += '\n';

      // Add remediation if available
      if (this.options.includeRemediation && firstViolation.remediation) {
        content += this.generateFeatureRemediation(firstViolation);
      }

      content += '---\n\n';
    }

    return content;
  }

  /**
   * Generate violations grouped by file
   * @param {Array} violations - Array of violations
   * @returns {string} Markdown content
   */
  generateMarkdownByFile(violations) {
    let content = `### 📁 Violations by File

`;

    // Group violations by file
    const byFile = this.groupBy(violations, v => v.feature.file);
    
    for (const [fileName, fileViolations] of Object.entries(byFile)) {
      content += `#### \`${fileName}\`

Found ${fileViolations.length} violation${fileViolations.length !== 1 ? 's' : ''}:

`;

      // Sort by line number
      fileViolations.sort((a, b) => (a.feature.location.line || 0) - (b.feature.location.line || 0));

      for (const violation of fileViolations.slice(0, this.options.maxViolationsPerFile)) {
        const loc = violation.feature.location;
        const severity = this.formatSeverity(violation.severity);
        
        content += `- **Line ${loc.line}**: ${violation.featureInfo?.name || violation.feature.featureId} ${severity}
  - Current: ${this.formatBaselineStatus(violation.currentStatus)}
  - Required: ${this.formatBaselineStatus(violation.requiredStatus)}
`;

        if (violation.feature.context && violation.feature.context.selector) {
          content += `  - Context: \`${violation.feature.context.selector}\`\n`;
        } else if (violation.feature.value) {
          content += `  - Value: \`${violation.feature.value}\`\n`;
        }

        content += '\n';
      }

      if (fileViolations.length > this.options.maxViolationsPerFile) {
        content += `... and ${fileViolations.length - this.options.maxViolationsPerFile} more violations\n\n`;
      }

      content += '---\n\n';
    }

    return content;
  }

  /**
   * Generate remediation section
   * @param {Array} violations - Array of violations
   * @returns {string} Markdown content
   */
  generateMarkdownRemediation(violations) {
    let content = `### 🛠️ Remediation Guide

`;

    // Get unique features for remediation
    const uniqueFeatures = this.getUniqueViolationsByFeature(violations);
    
    for (const violation of uniqueFeatures.slice(0, 10)) { // Limit to top 10
      if (!violation.remediation) continue;
      
      content += this.generateFeatureRemediation(violation);
    }

    return content;
  }

  /**
   * Generate remediation for a specific feature
   * @param {Object} violation - Violation object
   * @returns {string} Markdown content
   */
  generateFeatureRemediation(violation) {
    const featureName = violation.featureInfo?.name || violation.feature.featureId;
    let content = `#### ${featureName}

`;

    const remediation = violation.remediation;

    // Polyfill suggestions
    if (this.options.showPolyfillSuggestions && remediation.polyfillSuggestions?.length > 0) {
      content += '**Polyfills Available:**\n';
      for (const polyfill of remediation.polyfillSuggestions) {
        content += `- \`${polyfill}\`\n`;
      }
      content += '\n';
    }

    // Alternative features
    if (remediation.alternativeFeatures?.length > 0) {
      content += '**Alternative Features:**\n';
      for (const alternative of remediation.alternativeFeatures) {
        content += `- ${alternative}\n`;
      }
      content += '\n';
    }

    // Progressive enhancement
    if (remediation.progressiveEnhancement) {
      const pe = remediation.progressiveEnhancement;
      content += '**Progressive Enhancement:**\n';
      content += `${pe.description}\n\n`;
      
      if (pe.example) {
        content += `\`\`\`css\n${pe.example}\n\`\`\`\n\n`;
      }
    }

    // Code examples
    if (remediation.codeExamples?.length > 0) {
      for (const example of remediation.codeExamples) {
        content += `**${example.title}:**\n`;
        content += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n\n`;
      }
    }

    // Documentation links
    if (remediation.documentation?.length > 0) {
      content += '**Learn More:**\n';
      for (const doc of remediation.documentation) {
        content += `- [${doc.title}](${doc.url})\n`;
      }
      content += '\n';
    }

    // Estimated availability
    if (remediation.estimatedAvailabilityDate) {
      content += `**Estimated Widely Available**: ${remediation.estimatedAvailabilityDate}\n\n`;
    }

    return content;
  }

  /**
   * Generate markdown footer
   * @param {Object} metadata - Report metadata
   * @returns {string} Markdown footer
   */
  generateMarkdownFooter(metadata) {
    const baselineQueries = (metadata.baselineQueries && metadata.baselineQueries.length)
      ? metadata.baselineQueries.join(', ')
      : 'None';
    const enforcementMode = metadata.enforcementMode || 'per-feature';
    const dataSource = metadata.baselineDataSource || 'unknown';
  const mappingCount = metadata.mappingCount || '—';
  const mappedDetected = metadata.mappedDetected != null ? metadata.mappedDetected : '—';
  const mappingCoverage = metadata.mappingCoveragePercent != null ? `${metadata.mappingCoveragePercent.toFixed(2)}%` : '—';
    const autoConfigured = metadata.autoConfigured ? 'Yes' : 'No';

    return `### ℹ️ Report Information

- **Generated**: ${new Date(metadata.generatedAt).toLocaleString()}
- **Baseline Action**: v${metadata.actionVersion || '1.0.0'}
- **Total Features Analyzed**: ${metadata.totalFeatures || 0}
- **Baseline Queries Detected**: ${baselineQueries}
- **Auto Policy Config**: ${autoConfigured}
- **Enforcement Mode**: ${enforcementMode}
- **Mapping Count (loaded)**: ${mappingCount}
 - **Mapped Detected Features**: ${mappedDetected}
 - **Mapping Coverage**: ${mappingCoverage}
- **Baseline Data Source**: ${dataSource}

> 🧠 **Adaptive Policy**: Yearly rules auto-generated from Baseline year queries (older years escalate severity). See documentation section "Adaptive Yearly Enforcement".
> 💡 **Tip**: Use \`@supports\` and JS feature detection for progressive enhancement.

---
*This report was generated by the [Baseline GitHub Action](https://github.com/baseline/action)*`;
  }

  /**
   * Generate JSON report
   * @param {Object} reportData - Report data
   * @returns {string} JSON report
   */
  generateJSONReport(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  /**
   * Generate SARIF report
   * @param {Object} reportData - Report data
   * @returns {string} SARIF report
   */
  generateSARIFReport(reportData) {
    const { violations, metadata } = reportData;
    
    const sarifMetadata = {
      version: metadata.actionVersion || '1.0.0',
      baselineQueries: metadata.baselineQueries || [],
      autoConfigured: metadata.autoConfigured || false,
      enforcementMode: metadata.enforcementMode || 'per-feature'
    };
    
    return generateSarif(violations, sarifMetadata);
  }

  /**
   * Generate HTML report
   * @param {Object} reportData - Report data
   * @returns {string} HTML report
   */
  generateHTMLReport(reportData) {
    const { violations, summary, metadata } = reportData;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baseline Compliance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #e1e4e8; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f6f8fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .violation { border-left: 4px solid #d73a49; padding: 15px; margin-bottom: 20px; background: #ffeaea; }
        .severity-high { border-left-color: #d73a49; }
        .severity-medium { border-left-color: #f66a0a; }
        .severity-low { border-left-color: #0366d6; }
        .code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #e1e4e8; padding: 8px 12px; text-align: left; }
        th { background: #f6f8fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${violations.length > 0 ? '❌' : '✅'} Baseline Compliance Report</h1>
        <p>Generated on ${new Date(metadata.generatedAt).toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <table>
            <tr><th>Total Violations</th><td>${summary.total}</td></tr>
            <tr><th>Compliance Score</th><td>${metadata.complianceScore}%</td></tr>
            <tr><th>High Severity</th><td>${summary.bySeverity.high}</td></tr>
            <tr><th>Medium Severity</th><td>${summary.bySeverity.medium}</td></tr>
            <tr><th>Low Severity</th><td>${summary.bySeverity.low}</td></tr>
        </table>
    </div>
    
    ${violations.length > 0 ? this.generateHTMLViolations(violations) : '<p>✅ All features meet Baseline requirements!</p>'}
    
</body>
</html>`;
  }

  /**
   * Generate HTML violations section
   * @param {Array} violations - Array of violations
   * @returns {string} HTML content
   */
  generateHTMLViolations(violations) {
    let html = '<h2>Violations</h2>';
    
    for (const violation of violations.slice(0, 20)) { // Limit for HTML
      const severityClass = `severity-${violation.severity}`;
      html += `
        <div class="violation ${severityClass}">
            <h3>${violation.featureInfo?.name || violation.feature.featureId}</h3>
            <p><strong>File:</strong> <span class="code">${violation.feature.file}</span></p>
            <p><strong>Line:</strong> ${violation.feature.location.line}</p>
            <p><strong>Current Status:</strong> ${this.formatBaselineStatus(violation.currentStatus)}</p>
            <p><strong>Required Status:</strong> ${this.formatBaselineStatus(violation.requiredStatus)}</p>
            <p><strong>Severity:</strong> ${this.capitalizeFirst(violation.severity)}</p>
        </div>`;
    }
    
    return html;
  }

  /**
   * Save report to file
   * @param {string} content - Report content
   * @param {string} filePath - Output file path
   * @returns {Promise<void>}
   */
  async saveReport(content, filePath) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
      core.info(`Report saved to ${filePath}`);
    } catch (error) {
      core.error(`Failed to save report to ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate comment for GitHub PR
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Additional metadata
   * @returns {string} GitHub comment content
   */
  generateGitHubComment(violations, summary, metadata = {}) {
    // Add sticky marker for reliable comment updates
    let comment = '<!-- baseline-comment -->\n';
    
    if (violations.length === 0) {
      comment += this.generateSuccessMarkdown(metadata);
      return comment;
    }

    // Generate a condensed version for PR comments
    comment += this.generateMarkdownHeader(summary, metadata);
    comment += this.generateMarkdownSummary(summary, metadata);
    
    // Show top violations by file (limited)
    const byFile = this.groupBy(violations, v => v.feature.file);
    const topFiles = Object.entries(byFile).slice(0, 5);
    
    comment += '### 📁 Top Violations by File\n\n';
    
    for (const [fileName, fileViolations] of topFiles) {
      comment += `#### \`${fileName}\`\n`;
      
      for (const violation of fileViolations.slice(0, 3)) {
        const loc = violation.feature.location;
        comment += `- **Line ${loc.line}**: ${violation.featureInfo?.name || violation.feature.featureId} ${this.formatSeverity(violation.severity)}\n`;
      }
      
      if (fileViolations.length > 3) {
        comment += `- ... and ${fileViolations.length - 3} more\n`;
      }
      
      comment += '\n';
    }
    
    if (Object.keys(byFile).length > 5) {
      comment += `... and violations in ${Object.keys(byFile).length - 5} more files\n\n`;
    }
    
    comment += '### 🛠️ Quick Fixes\n\n';
    comment += 'Consider using feature detection and progressive enhancement to maintain compatibility.\n\n';
    
    comment += this.generateMarkdownFooter(metadata);
    
    return comment;
  }

  // Helper methods

  /**
   * Group array by key function
   * @param {Array} array - Array to group
   * @param {Function} keyFn - Key function
   * @returns {Object} Grouped object
   */
  groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
      const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Get unique violations by feature
   * @param {Array} violations - Array of violations
   * @returns {Array} Unique violations
   */
  getUniqueViolationsByFeature(violations) {
    const seen = new Set();
    return violations.filter(violation => {
      if (seen.has(violation.feature.featureId)) {
        return false;
      }
      seen.add(violation.feature.featureId);
      return true;
    });
  }

  /**
   * Format baseline status for display
   * @param {string} status - Baseline status
   * @returns {string} Formatted status
   */
  formatBaselineStatus(status) {
    const statusMap = {
      'limited': '🔴 Limited',
      'newly': '🟡 Newly Interoperable',
      'widely': '🟢 Widely Available',
      'unknown': '❓ Unknown'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Format severity for display
   * @param {string} severity - Severity level
   * @returns {string} Formatted severity
   */
  formatSeverity(severity) {
    const severityMap = {
      'high': '🚨 High',
      'medium': '⚠️ Medium',
      'low': '💡 Low'
    };
    
    return severityMap[severity] || severity;
  }

  /**
   * Capitalize first letter
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = ReportGenerator;