/**
 * Generates simple ASCII charts and visualizations for reports
 */

class ReportVisualizer {
  /**
   * Generate a simple compliance score bar chart
   * @param {number} score - Compliance score (0-100)
   * @returns {string} ASCII bar chart
   */
  static generateComplianceBar(score) {
    const width = 20;
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const emoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
    
    return `${emoji} ${bar} ${score}%`;
  }

  /**
   * Generate severity distribution chart
   * @param {Object} severityCounts - {high: n, medium: n, low: n}
   * @returns {string} ASCII chart
   */
  static generateSeverityChart(severityCounts) {
    const { high = 0, medium = 0, low = 0 } = severityCounts;
    const total = high + medium + low;
    
    if (total === 0) return '✅ No violations found';
    
    const maxWidth = 15;
    
    const highWidth = Math.round((high / total) * maxWidth);
    const mediumWidth = Math.round((medium / total) * maxWidth);
    const lowWidth = Math.round((low / total) * maxWidth);
    
    const chart = [
      high > 0 ? `🚨 High    [${'█'.repeat(highWidth).padEnd(maxWidth, '░')}] ${high}` : '',
      medium > 0 ? `⚠️  Medium  [${'█'.repeat(mediumWidth).padEnd(maxWidth, '░')}] ${medium}` : '',
      low > 0 ? `💡 Low     [${'█'.repeat(lowWidth).padEnd(maxWidth, '░')}] ${low}` : ''
    ].filter(line => line).join('\n');
    
    return chart;
  }

  /**
   * Generate feature type distribution
   * @param {Object} typeCounts - {css: n, javascript: n, html: n}
   * @returns {string} ASCII chart
   */
  static generateTypeDistribution(typeCounts) {
    const entries = Object.entries(typeCounts);
    if (entries.length === 0) return '';
    
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const maxWidth = 12;
    
    return entries.map(([type, count]) => {
      const width = Math.round((count / total) * maxWidth);
      const percentage = Math.round((count / total) * 100);
      const emoji = type === 'css' ? '🎨' : type === 'javascript' ? '⚡' : '📄';
      
      return `${emoji} ${type.padEnd(10)} [${'█'.repeat(width).padEnd(maxWidth, '░')}] ${count} (${percentage}%)`;
    }).join('\n');
  }

  /**
   * Generate simple trend indicator
   * @param {number} current - Current score
   * @param {number} previous - Previous score (optional)
   * @returns {string} Trend indicator
   */
  static generateTrendIndicator(current, previous = null) {
    if (previous === null) return '';
    
    const diff = current - previous;
    
    if (Math.abs(diff) < 1) return '➡️ No change';
    if (diff > 0) return `📈 +${diff.toFixed(1)}% improvement`;
    return `📉 ${diff.toFixed(1)}% decline`;
  }

  /**
   * Generate a simple compliance status badge
   * @param {number} score - Compliance score
   * @param {number} violations - Number of violations
   * @returns {string} Status badge
   */
  static generateStatusBadge(score, violations) {
    if (violations === 0) return '🛡️ COMPLIANT';
    if (score >= 80) return '⚠️ MINOR ISSUES';
    if (score >= 60) return '🔶 NEEDS ATTENTION';
    return '🚨 CRITICAL ISSUES';
  }

  /**
   * Generate enhanced markdown report section with visuals
   * @param {Object} data - Report data
   * @returns {string} Enhanced markdown section
   */
  static generateEnhancedSummary(data) {
    const { score, violations, summary } = data;
    
    return `
## 📊 Compliance Dashboard

### Overall Status
\`\`\`
${this.generateStatusBadge(score, violations.length)}

Compliance Score: ${this.generateComplianceBar(score)}
Total Violations: ${violations.length}
\`\`\`

### Severity Breakdown
\`\`\`
${this.generateSeverityChart(summary.bySeverity)}
\`\`\`

### Violations by Type  
\`\`\`
${this.generateTypeDistribution(summary.byFeatureType)}
\`\`\`
`;
  }
}

module.exports = ReportVisualizer;