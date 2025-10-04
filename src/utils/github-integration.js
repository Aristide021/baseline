const github = require('@actions/github');
const core = require('@actions/core');

/**
 * Handles GitHub integration for status checks, PR comments, and workflow outputs
 */
class GitHubIntegration {
  constructor(token, options = {}) {
    this.octokit = github.getOctokit(token);
    this.context = github.context;
    this.options = {
      commentOnPR: options.commentOnPR !== false,
      updateExistingComment: options.updateExistingComment !== false,
      createStatusCheck: options.createStatusCheck !== false,
      statusCheckName: options.statusCheckName || 'Baseline Compliance',
      ...options
    };
  }

  /**
   * Process GitHub integration tasks
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Additional metadata
   * @param {string} reportContent - Full report content
   * @returns {Promise<void>}
   */
  async processResults(violations, summary, metadata, _reportContent) {
    const hasViolations = violations.length > 0;
    const complianceScore = metadata.complianceScore || 0;

    // Create or update PR comment
    if (this.isPullRequest() && this.options.commentOnPR) {
      await this.handlePRComment(violations, summary, metadata);
    }

    // Create status check
    if (this.options.createStatusCheck && this.context.payload.pull_request) {
      await this.createStatusCheck(hasViolations, violations.length, complianceScore);
    }

    // Set workflow outputs
    await this.setWorkflowOutputs(violations, summary, metadata);

    // Add workflow annotations for violations
    await this.addWorkflowAnnotations(violations);

    core.info(`GitHub integration completed. ${hasViolations ? 'Found violations' : 'No violations found'}.`);
  }

  /**
   * Handle PR comment creation or update
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async handlePRComment(violations, summary, metadata) {
    try {
      const ReportGenerator = require('./report-generator');
      const reportGenerator = new ReportGenerator();
      const commentContent = reportGenerator.generateGitHubComment(violations, summary, metadata);

      if (this.options.updateExistingComment) {
        await this.updateExistingComment(commentContent);
      } else {
        await this.createNewComment(commentContent);
      }
    } catch (error) {
      core.warning(`Failed to handle PR comment: ${error.message}`);
    }
  }

  /**
   * Create a new PR comment
   * @param {string} commentContent - Comment content
   * @returns {Promise<void>}
   */
  async createNewComment(commentContent) {
    if (!this.context.payload.pull_request) {
      core.debug('Not a pull request, skipping comment creation');
      return;
    }

    try {
      const { data: comment } = await this.octokit.rest.issues.createComment({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request.number,
        body: commentContent
      });

      core.info(`Created PR comment: ${comment.html_url}`);
    } catch (error) {
      core.warning(`Failed to create PR comment: ${error.message}`);
    }
  }

  /**
   * Update existing PR comment or create new one
   * @param {string} commentContent - Comment content
   * @returns {Promise<void>}
   */
  async updateExistingComment(commentContent) {
    if (!this.context.payload.pull_request) {
      core.debug('Not a pull request, skipping comment update');
      return;
    }

    try {
      // Find existing Baseline comment
      const existingComment = await this.findExistingComment();

      if (existingComment) {
        // Update existing comment
        await this.octokit.rest.issues.updateComment({
          ...this.context.repo,
          comment_id: existingComment.id,
          body: commentContent
        });

        core.info(`Updated existing PR comment: ${existingComment.html_url}`);
      } else {
        // Create new comment if none exists
        await this.createNewComment(commentContent);
      }
    } catch (error) {
      core.warning(`Failed to update PR comment: ${error.message}`);
    }
  }

  /**
   * Find existing Baseline comment in PR
   * @returns {Promise<Object|null>} Existing comment or null
   */
  async findExistingComment() {
    try {
      const { data: comments } = await this.octokit.rest.issues.listComments({
        ...this.context.repo,
        issue_number: this.context.payload.pull_request.number,
        per_page: 100
      });

      return comments.find(comment => 
        comment.user.type === 'Bot' && 
        comment.body.includes('<!-- baseline-comment -->')
      ) || null;
    } catch (error) {
      core.debug(`Failed to find existing comments: ${error.message}`);
      return null;
    }
  }

  /**
   * Create status check
   * @param {boolean} hasViolations - Whether violations were found
   * @param {number} violationCount - Number of violations
   * @param {number} complianceScore - Compliance score
   * @returns {Promise<void>}
   */
  async createStatusCheck(hasViolations, violationCount, complianceScore) {
    try {
      const conclusion = hasViolations ? 'failure' : 'success';
      const summary = hasViolations ? 
        `Found ${violationCount} Baseline compliance violation${violationCount !== 1 ? 's' : ''}` :
        'All features meet Baseline requirements';

      const checkRun = await this.octokit.rest.checks.create({
        ...this.context.repo,
        name: this.options.statusCheckName,
        head_sha: this.getHeadSha(),
        status: 'completed',
        conclusion: conclusion,
        output: {
          title: this.options.statusCheckName,
          summary: summary,
          text: this.generateStatusCheckText(hasViolations, violationCount, complianceScore)
        }
      });

      core.info(`Created status check: ${checkRun.data.html_url}`);
    } catch (error) {
      core.warning(`Failed to create status check: ${error.message}`);
    }
  }

  /**
   * Generate text for status check
   * @param {boolean} hasViolations - Whether violations were found
   * @param {number} violationCount - Number of violations
   * @param {number} complianceScore - Compliance score
   * @returns {string} Status check text
   */
  generateStatusCheckText(hasViolations, violationCount, complianceScore) {
    if (!hasViolations) {
      return '✅ All web platform features in your code meet the specified Baseline requirements.';
    }

    return `❌ Found ${violationCount} feature${violationCount !== 1 ? 's' : ''} that don't meet Baseline requirements.

**Compliance Score:** ${complianceScore}%

Check the PR comment or full report for detailed information about violations and remediation suggestions.`;
  }

  /**
   * Set workflow outputs
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async setWorkflowOutputs(violations, summary, metadata) {
    try {
      // Set core outputs
      core.setOutput('violations-count', violations.length.toString());
      core.setOutput('compliance-score', (metadata.complianceScore || 0).toString());
      core.setOutput('has-violations', violations.length > 0 ? 'true' : 'false');
      
      // Set summary outputs
      core.setOutput('high-severity-count', summary.bySeverity.high.toString());
      core.setOutput('medium-severity-count', summary.bySeverity.medium.toString());
      core.setOutput('low-severity-count', summary.bySeverity.low.toString());

      // Set feature type counts
      for (const [type, count] of Object.entries(summary.byFeatureType)) {
        core.setOutput(`${type}-violations-count`, count.toString());
      }

      // Set metadata outputs
      if (metadata.baseline?.threshold) {
        core.setOutput('baseline-threshold', metadata.baseline.threshold);
      }
      
      if (metadata.totalFeatures) {
        core.setOutput('total-features-analyzed', metadata.totalFeatures.toString());
      }

      core.debug('Workflow outputs set successfully');
    } catch (error) {
      core.warning(`Failed to set workflow outputs: ${error.message}`);
    }
  }

  /**
   * Add workflow annotations for violations
   * @param {Array} violations - Array of violations
   * @returns {Promise<void>}
   */
  async addWorkflowAnnotations(violations) {
    try {
      // Limit annotations to prevent overwhelming the UI
      const maxAnnotations = 50;
      
      // Deduplicate violations by feature and file to prevent duplicate warnings
      const seenViolations = new Set();
      const uniqueViolations = violations.filter(violation => {
        const key = `${violation.feature.featureId}-${violation.feature.file}-${violation.feature.location.line || 1}`;
        if (seenViolations.has(key)) {
          return false;
        }
        seenViolations.add(key);
        return true;
      });
      
      const annotationsToAdd = uniqueViolations.slice(0, maxAnnotations);

      for (const violation of annotationsToAdd) {
        const feature = violation.feature;
        const location = feature.location;
        
        const message = `Baseline violation: ${violation.featureInfo?.name || feature.featureId} (${violation.currentStatus} → ${violation.requiredStatus} required)`;
        
        const annotationProps = {
          title: 'Baseline Compliance Violation',
          file: feature.file,
          startLine: location.line || 1,
          endLine: location.endLine || location.line || 1
        };

        // Add column info if available
        if (location.column) {
          annotationProps.startColumn = location.column;
          if (location.endColumn) {
            annotationProps.endColumn = location.endColumn;
          }
        }

        // Create annotation based on severity
        switch (violation.severity) {
        case 'high':
          core.error(message, annotationProps);
          break;
        case 'medium':
          core.warning(message, annotationProps);
          break;
        case 'low':
          core.notice(message, annotationProps);
          break;
        default:
          core.warning(message, annotationProps);
        }
      }

      if (uniqueViolations.length > maxAnnotations) {
        core.warning(`Added ${maxAnnotations} annotations out of ${uniqueViolations.length} unique violations. See full report for complete details.`);
      }
      
      if (violations.length > uniqueViolations.length) {
        core.debug(`Deduplicated ${violations.length - uniqueViolations.length} duplicate violation(s) for cleaner output`);
      }

      core.debug(`Added ${annotationsToAdd.length} workflow annotations`);
    } catch (error) {
      core.warning(`Failed to add workflow annotations: ${error.message}`);
    }
  }

  /**
   * Get changed files in the current PR or push
   * @returns {Promise<Array>} Array of changed files
   */
  async getChangedFiles() {
    try {
      if (this.isPullRequest()) {
        return await this.getPRChangedFiles();
      } else if (this.isPush()) {
        return await this.getPushChangedFiles();
      } else {
        core.debug('Not a PR or push event, analyzing all files');
        return [];
      }
    } catch (error) {
      core.warning(`Failed to get changed files: ${error.message}`);
      return [];
    }
  }

  /**
   * Get changed files in PR
   * @returns {Promise<Array>} Array of changed files
   */
  async getPRChangedFiles() {
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      ...this.context.repo,
      pull_number: this.context.payload.pull_request.number,
      per_page: 100
    });

    return files.filter(file => 
      file.status !== 'removed' &&
      this.isRelevantFile(file.filename)
    );
  }

  /**
   * Get changed files in push
   * @returns {Promise<Array>} Array of changed files
   */
  async getPushChangedFiles() {
    const { data: comparison } = await this.octokit.rest.repos.compareCommits({
      ...this.context.repo,
      base: this.context.payload.before,
      head: this.context.payload.after
    });

    return comparison.files?.filter(file => 
      file.status !== 'removed' &&
      this.isRelevantFile(file.filename)
    ) || [];
  }

  /**
   * Check if file is relevant for Baseline analysis
   * @param {string} filename - File name
   * @returns {boolean} True if file should be analyzed
   */
  isRelevantFile(filename) {
    const relevantExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.sass', '.less', '.html', '.htm', '.vue', '.svelte'];
    return relevantExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Filter files based on include/exclude patterns
   * @param {Array} files - Array of file objects
   * @param {string} includePatterns - Include patterns
   * @param {string} excludePatterns - Exclude patterns
   * @returns {Array} Filtered files
   */
  filterFiles(files, includePatterns, excludePatterns) {
    const micromatch = require('micromatch');
    
    let filteredFiles = files;

    // Apply include patterns
    if (includePatterns) {
      const includeGlobs = includePatterns.split(',').map(p => p.trim());
      filteredFiles = filteredFiles.filter(file => 
        micromatch.isMatch(file.filename, includeGlobs)
      );
    }

    // Apply exclude patterns
    if (excludePatterns) {
      const excludeGlobs = excludePatterns.split(',').map(p => p.trim());
      filteredFiles = filteredFiles.filter(file => 
        !micromatch.isMatch(file.filename, excludeGlobs)
      );
    }

    return filteredFiles;
  }

  /**
   * Create workflow summary
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async createWorkflowSummary(violations, summary, metadata) {
    try {
      const summaryContent = this.generateWorkflowSummary(violations, summary, metadata);
      await core.summary.addRaw(summaryContent).write();
      core.info('Workflow summary created');
    } catch (error) {
      core.warning(`Failed to create workflow summary: ${error.message}`);
    }
  }

  /**
   * Generate workflow summary content
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @param {Object} metadata - Additional metadata
   * @returns {string} Summary content
   */
  generateWorkflowSummary(violations, summary, metadata) {
    const hasViolations = violations.length > 0;
    
    let content = `# ${hasViolations ? '❌' : '✅'} Baseline Compliance Report\n\n`;
    
    if (!hasViolations) {
      content += '## ✅ All Clear!\n\n';
      content += 'All detected web platform features meet your Baseline requirements.\n\n';
      content += `- **Total Features Analyzed**: ${metadata.totalFeatures || 0}\n`;
      content += `- **Compliance Score**: ${metadata.complianceScore || 100}%\n`;
      return content;
    }

    content += '## Summary\n\n';
    content += '| Metric | Value |\n';
    content += '|--------|-------|\n';
    content += `| Total Violations | ${summary.total} |\n`;
    content += `| Compliance Score | ${metadata.complianceScore || 0}% |\n`;
    content += `| High Severity | ${summary.bySeverity.high} |\n`;
    content += `| Medium Severity | ${summary.bySeverity.medium} |\n`;
    content += `| Low Severity | ${summary.bySeverity.low} |\n`;

    content += '\n## Violations by Feature Type\n\n';
    for (const [type, count] of Object.entries(summary.byFeatureType)) {
      const percentage = Math.round((count / summary.total) * 100);
      content += `- **${type.charAt(0).toUpperCase() + type.slice(1)}**: ${count} (${percentage}%)\n`;
    }

    return content;
  }

  // Helper methods

  /**
   * Check if current event is a pull request
   * @returns {boolean} True if PR event
   */
  isPullRequest() {
    return this.context.eventName === 'pull_request' && !!this.context.payload.pull_request;
  }

  /**
   * Check if current event is a push
   * @returns {boolean} True if push event
   */
  isPush() {
    return this.context.eventName === 'push' && !!this.context.payload.before;
  }

  /**
   * Get the HEAD SHA for the current context
   * @returns {string} HEAD SHA
   */
  getHeadSha() {
    if (this.context.payload.pull_request) {
      return this.context.payload.pull_request.head.sha;
    } else if (this.context.payload.after) {
      return this.context.payload.after;
    } else {
      return this.context.sha;
    }
  }

  /**
   * Get repository information
   * @returns {Object} Repository info
   */
  getRepoInfo() {
    return {
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      ref: this.context.ref,
      sha: this.getHeadSha()
    };
  }

  /**
   * Create GitHub issue for violations (optional feature)
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @returns {Promise<void>}
   */
  async createIssueForViolations(violations, summary) {
    if (violations.length === 0) return;

    try {
      const issueTitle = `Baseline Compliance Issues Found - ${violations.length} violations`;
      const issueBody = this.generateIssueBody(violations, summary);

      const { data: issue } = await this.octokit.rest.issues.create({
        ...this.context.repo,
        title: issueTitle,
        body: issueBody,
        labels: ['baseline', 'compliance', 'technical-debt']
      });

      core.info(`Created issue for violations: ${issue.html_url}`);
    } catch (error) {
      core.warning(`Failed to create issue: ${error.message}`);
    }
  }

  /**
   * Generate issue body for violations
   * @param {Array} violations - Array of violations
   * @param {Object} summary - Violations summary
   * @returns {string} Issue body
   */
  generateIssueBody(violations, summary) {
    let body = '## Baseline Compliance Issues\n\n';
    body += `Found ${violations.length} features that don't meet Baseline requirements.\n\n`;
    body += '### Summary\n';
    body += `- High Severity: ${summary.bySeverity.high}\n`;
    body += `- Medium Severity: ${summary.bySeverity.medium}\n`;
    body += `- Low Severity: ${summary.bySeverity.low}\n\n`;
    
    // Add top violations
    const topViolations = violations.slice(0, 10);
    body += '### Top Violations\n\n';
    
    for (const violation of topViolations) {
      body += `- **${violation.featureInfo?.name || violation.feature.featureId}** in \`${violation.feature.file}\`\n`;
      body += `  - Current: ${violation.currentStatus}, Required: ${violation.requiredStatus}\n`;
      body += `  - Severity: ${violation.severity}\n\n`;
    }
    
    body += '\n---\n*Auto-generated by Baseline GitHub Action*';
    
    return body;
  }
}

module.exports = GitHubIntegration;