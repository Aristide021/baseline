const core = require('@actions/core');
const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

// Import our modules
const ConfigLoader = require('./utils/config-loader');
const BaselineDataManager = require('./utils/baseline-data-manager');
const CSSFeatureDetector = require('./detectors/css-feature-detector');
const JSFeatureDetector = require('./detectors/js-feature-detector');
const HTMLFeatureDetector = require('./detectors/html-feature-detector');
const PolicyEngine = require('./engines/policy-engine');
const ReportGenerator = require('./utils/report-generator');
const GitHubIntegration = require('./utils/github-integration');

/**
 * Main Baseline GitHub Action entry point
 */
class BaselineAction {
  constructor() {
    this.startTime = Date.now();
    this.config = null;
    this.baselineDataManager = null;
    this.detectors = {};
    this.policyEngine = null;
    this.reportGenerator = null;
    this.githubIntegration = null;
    this.allFeatures = [];
    this.violations = [];
    this.summary = {};
    this.filesAnalyzed = [];
  }

  /**
   * Run the Baseline action
   * @returns {Promise<void>}
   */
  async run() {
    try {
      core.info('🚀 Starting Baseline compliance check...');
      
      // Initialize components
      await this.initialize();
      
      // Get files to analyze
      const filesToAnalyze = await this.getFilesToAnalyze();
      this.totalFilesScanned = filesToAnalyze.length;
  this.filesAnalyzed = filesToAnalyze;
      core.info(`📁 Found ${filesToAnalyze.length} files to analyze`);
      
      if (filesToAnalyze.length === 0) {
        core.info('✅ No files to analyze, compliance check passed');
        await this.handleSuccess();
        return;
      }
      
      // Analyze files for features
      await this.analyzeFiles(filesToAnalyze);
      core.info(`🔍 Detected ${this.allFeatures.length} total features`);
      
      // Evaluate features against policies
      await this.evaluateCompliance();
      core.info(`📊 Found ${this.violations.length} compliance violations`);
      
      // Generate reports and handle results
      await this.generateReports();
      await this.handleResults();
      
      // Performance summary
      const duration = Date.now() - this.startTime;
      core.info(`✅ Baseline compliance check completed in ${duration}ms`);
      
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Initialize all components
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load configuration
      core.info('📋 Loading configuration...');
      const configLoader = new ConfigLoader();
      this.config = await configLoader.loadConfig();
      
      // Initialize Baseline data manager
      core.info('🌐 Initializing Baseline data manager...');
      this.baselineDataManager = new BaselineDataManager({
        cacheDir: path.join(process.cwd(), '.baseline-cache')
      });
      await this.baselineDataManager.initialize();
      
      // Load Baseline data
      core.info('📥 Loading Baseline feature data...');
      await this.baselineDataManager.getAllBaselineFeatures();
      
      // Initialize detectors
      this.detectors = {
        css: new CSSFeatureDetector(this.config.rules?.css),
        js: new JSFeatureDetector(this.config.rules?.javascript),
        html: new HTMLFeatureDetector(this.config.rules?.html)
      };
      
      // Initialize policy engine
      this.policyEngine = new PolicyEngine(this.config, this.baselineDataManager);
      
      // Initialize report generator
      this.reportGenerator = new ReportGenerator(this.config.reporting);
      
      // Initialize GitHub integration if token is available
      const githubToken = core.getInput('github-token') || process.env.GITHUB_TOKEN;
      if (githubToken) {
        this.githubIntegration = new GitHubIntegration(githubToken, this.config.github);
      }
      
      core.info('✅ All components initialized successfully');
      
    } catch (error) {
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  /**
   * Get list of files to analyze
   * @returns {Promise<Array>} Array of file paths
   */
  async getFilesToAnalyze() {
    let filesToAnalyze = [];
    const scanMode = core.getInput('scan-mode') || 'auto';
    
    try {
      if (scanMode === 'repo') {
        // Always scan all files regardless of changes
        core.info('📁 Scan mode: repo - analyzing all matching files');
        filesToAnalyze = await this.getAllMatchingFiles();
      } else if (scanMode === 'diff') {
        // Only scan changed files, fail if none
        if (this.githubIntegration) {
          const changedFiles = await this.githubIntegration.getChangedFiles();
          if (changedFiles.length > 0) {
            core.info(`📝 Scan mode: diff - analyzing ${changedFiles.length} changed files`);
            filesToAnalyze = changedFiles.map(file => file.filename);
          } else {
            core.warning('Scan mode: diff - no changed files found, analysis skipped');
            return [];
          }
        } else {
          core.warning('Scan mode: diff - no GitHub context available, falling back to repo mode');
          filesToAnalyze = await this.getAllMatchingFiles();
        }
      } else {
        // Auto mode: try changed files first, fallback to all
        if (this.githubIntegration) {
          const changedFiles = await this.githubIntegration.getChangedFiles();
          
          if (changedFiles.length > 0) {
            core.info(`📝 Scan mode: auto - analyzing ${changedFiles.length} changed files from PR/push`);
            filesToAnalyze = changedFiles.map(file => file.filename);
          }
        }
        
        // If no changed files, analyze all files matching patterns
        if (filesToAnalyze.length === 0) {
          core.info('📁 Scan mode: auto - no changed files detected, analyzing all matching files');
          filesToAnalyze = await this.getAllMatchingFiles();
        }
      }
      
      // Apply filters
      filesToAnalyze = this.applyFileFilters(filesToAnalyze);
      
      return filesToAnalyze;
      
    } catch (error) {
      core.warning(`Failed to get files list: ${error.message}, falling back to pattern matching`);
      return await this.getAllMatchingFiles();
    }
  }

  /**
   * Get all files matching include patterns
   * @returns {Promise<Array>} Array of file paths
   */
  async getAllMatchingFiles() {
    const includePatterns = this.config.enforcement['include-patterns'];
    const patterns = Array.isArray(includePatterns) ? includePatterns : [includePatterns];
    
    const allFiles = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { 
          cwd: process.cwd(),
          ignore: this.config.enforcement['ignore-patterns'] || []
        });
        allFiles.push(...files);
      } catch (err) {
        core.warning(`Failed to glob pattern ${pattern}: ${err.message}`);
      }
    }
    
    // Remove duplicates and sort
    return [...new Set(allFiles)].sort();
  }

  /**
   * Apply include/exclude filters to file list
   * @param {Array} files - Array of file paths
   * @returns {Array} Filtered file paths
   */
  applyFileFilters(files) {
    const micromatch = require('micromatch');
    
    let filteredFiles = files;
    
    // Apply include patterns
    const includePatterns = this.config.enforcement['include-patterns'];
    if (includePatterns) {
      const patterns = Array.isArray(includePatterns) ? includePatterns : [includePatterns];
      filteredFiles = filteredFiles.filter(file => 
        patterns.some(pattern => micromatch.isMatch(file, pattern))
      );
    }
    
    // Apply exclude patterns
    const excludePatterns = this.config.enforcement['ignore-patterns'];
    if (excludePatterns) {
      const patterns = Array.isArray(excludePatterns) ? excludePatterns : [excludePatterns];
      filteredFiles = filteredFiles.filter(file => 
        !patterns.some(pattern => micromatch.isMatch(file, pattern))
      );
    }
    
    return filteredFiles;
  }

  /**
   * Analyze files for web platform features
   * @param {Array} filePaths - Array of file paths to analyze
   * @returns {Promise<void>}
   */
  async analyzeFiles(filePaths) {
    core.info('🔍 Analyzing files for web platform features...');
    
    const analysisPromises = filePaths.map(async (filePath) => {
      try {
        return await this.analyzeFile(filePath);
      } catch (error) {
        core.warning(`Failed to analyze ${filePath}: ${error.message}`);
        return [];
      }
    });
    
    const results = await Promise.all(analysisPromises);
    
    // Flatten all features
    this.allFeatures = results.flat();
    
    core.debug(`Feature detection completed: ${this.allFeatures.length} features found`);
  }

  /**
   * Analyze a single file
   * @param {string} filePath - Path to file to analyze
   * @returns {Promise<Array>} Array of detected features
   */
  async analyzeFile(filePath) {
    const absolutePath = path.resolve(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    const features = [];
    
    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      
      // Detect features based on file type
      switch (fileExtension) {
      case '.css':
      case '.scss':
      case '.sass':
      case '.less':
        features.push(...await this.detectors.css.detectFeatures(content, filePath));
        break;
          
      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
        features.push(...await this.detectors.js.detectFeatures(content, filePath));
        break;
          
      case '.html':
      case '.htm':
        features.push(...await this.detectors.html.detectFeatures(content, filePath));
        // Also analyze any inline CSS/JS
        features.push(...await this.analyzeInlineCode(content, filePath));
        break;
          
      case '.vue':
      case '.svelte':
        // Handle component files
        features.push(...await this.analyzeComponentFile(content, filePath));
        break;
      }
      
      return features;
      
    } catch (error) {
      core.debug(`Error reading ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze inline CSS and JavaScript in HTML files
   * @param {string} htmlContent - HTML content
   * @param {string} filePath - File path
   * @returns {Promise<Array>} Array of detected features
   */
  async analyzeInlineCode(htmlContent, filePath) {
    const features = [];
    
    try {
      // Extract inline CSS
      const styleMatches = htmlContent.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      for (const match of styleMatches) {
        const cssContent = match[1];
        features.push(...await this.detectors.css.detectFeatures(cssContent, `${filePath}:inline-css`));
      }
      
      // Extract inline JavaScript
      const scriptMatches = htmlContent.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of scriptMatches) {
        const jsContent = match[1];
        if (jsContent.trim()) {
          features.push(...await this.detectors.js.detectFeatures(jsContent, `${filePath}:inline-js`));
        }
      }
      
    } catch (error) {
      core.debug(`Error analyzing inline code in ${filePath}: ${error.message}`);
    }
    
    return features;
  }

  /**
   * Analyze Vue/Svelte component files
   * @param {string} content - Component file content
   * @param {string} filePath - File path
   * @returns {Promise<Array>} Array of detected features
   */
  async analyzeComponentFile(content, filePath) {
    const features = [];
    
    try {
      // Extract template (HTML)
      const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
      if (templateMatch) {
        features.push(...await this.detectors.html.detectFeatures(templateMatch[1], `${filePath}:template`));
      }
      
      // Extract style (CSS)
      const styleMatches = content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      for (const match of styleMatches) {
        features.push(...await this.detectors.css.detectFeatures(match[1], `${filePath}:style`));
      }
      
      // Extract script (JavaScript/TypeScript)
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      if (scriptMatch) {
        features.push(...await this.detectors.js.detectFeatures(scriptMatch[1], `${filePath}:script`));
      }
      
    } catch (error) {
      core.debug(`Error analyzing component file ${filePath}: ${error.message}`);
    }
    
    return features;
  }

  /**
   * Evaluate features against compliance policies
   * @returns {Promise<void>}
   */
  async evaluateCompliance() {
    core.info('📊 Evaluating features against Baseline policies...');
    
    this.violations = await this.policyEngine.evaluateFeatures(this.allFeatures);
    this.summary = this.policyEngine.getViolationsSummary();
  }

  /**
   * Generate reports
   * @returns {Promise<void>}
   */
  async generateReports() {
    core.info('📄 Generating compliance reports...');
    
    const metadata = {
      totalFeatures: this.allFeatures.length,
      totalFilesScanned: this.totalFilesScanned || 0,
      complianceScore: this.policyEngine.calculateComplianceScore(this.allFeatures, this.violations),
      baseline: {
        threshold: this.config.rules?.css?.['baseline-threshold'] || 'newly'
      },
      actionVersion: '1.0.0',
      baselineQueries: this.config.baselineQueries?.queries || [],
      autoConfigured: this.config.baselineQueries?.hasBaselineQueries || false,
      enforcementMode: this.config.enforcement?.mode || 'per-feature',
      mappingCount: this.baselineDataManager?.mappingCount || 0,
      baselineDataSource: this.baselineDataManager?.dataSource || 'unknown'
    };

    // Compute mapping coverage (detected features that have mapping info)
    try {
      if (this.baselineDataManager?.getFeatureInfo && this.allFeatures.length) {
        // Check if baseline data is actually loaded
        const cacheSize = this.baselineDataManager.cache?.get('all-baseline-features')?.size || 0;
        core.info(`Computing mapping coverage for ${this.allFeatures.length} features (baseline cache: ${cacheSize} features)`);
        
        if (cacheSize === 0) {
          core.warning('Baseline data cache is empty - mapping coverage will be 0%');
          metadata.mappedDetected = 0;
          metadata.mappingCoveragePercent = 0;
        }
        // Work with unique feature IDs to avoid skew from repeated occurrences
        const uniqueIds = [...new Set(this.allFeatures.map(f => f.featureId).filter(Boolean))];
        core.info(`🔍 Unique feature IDs detected: ${uniqueIds.length}`);
        core.info(`📋 First 10 Feature IDs: ${uniqueIds.slice(0, 10).join(', ')}${uniqueIds.length > 10 ? '...' : ''}`);
        core.info(`🎯 Baseline data manager alias map size: ${this.baselineDataManager.aliasMap?.size || 0}`);
        core.info(`📊 Baseline data manager cache size: ${cacheSize}`);
        let mappedDetected = 0;
        for (const fid of uniqueIds) {
          let info = this.baselineDataManager.getFeatureInfo(fid);
          if (info) {
            core.debug(`Feature ${fid}: mapped (exact)`);
            mappedDetected++;
            continue;
          }
          const variations = [
            fid + '-property',
            fid + '-layout',
            fid?.includes('-') ? fid.replace(/-/g, '_') : undefined,
            fid?.includes('_') ? fid.replace(/_/g, '-') : undefined,
            fid.toLowerCase()
          ].filter(Boolean);
          let matched = false;
            for (const variant of variations) {
              info = this.baselineDataManager.getFeatureInfo(variant);
              if (info) {
                core.debug(`Feature ${fid}: mapped (via ${variant})`);
                mappedDetected++;
                matched = true;
                break;
              }
            }
          if (!matched) {
            core.debug(`Feature ${fid}: not mapped`);
          }
        }
        metadata.mappedDetected = mappedDetected;
        metadata.mappingCoveragePercent = uniqueIds.length ? (mappedDetected / uniqueIds.length * 100) : 0;
        metadata.uniqueFeatureIds = uniqueIds.length;
        core.info(`Mapping coverage: ${mappedDetected}/${uniqueIds.length} unique (${metadata.mappingCoveragePercent.toFixed(1)}%)`);
      } else {
        core.debug(`Mapping coverage calculation skipped: manager=${!!this.baselineDataManager}, getFeatureInfo=${!!this.baselineDataManager?.getFeatureInfo}, features=${this.allFeatures.length}`);
        metadata.mappedDetected = 0;
        metadata.mappingCoveragePercent = 0;
      }
    } catch (e) {
      core.warning(`Failed to compute mapping coverage: ${e.message}`);
      metadata.mappedDetected = 0;
      metadata.mappingCoveragePercent = 0;
    }
    
    // Get output format from input
    const outputFormat = core.getInput('output-format') || 'json';
    const sarifOutputPath = core.getInput('sarif-output');
    
    // Configure report generator with requested format
    this.reportGenerator.options.outputFormat = outputFormat;
    
    // Generate main report
    const reportContent = await this.reportGenerator.generateReport(
      this.violations, 
      this.summary, 
      metadata
    );
    
    // Save main report to file
    const reportExtension = outputFormat === 'sarif' ? 'sarif' : (outputFormat === 'json' ? 'json' : 'md');
    const reportPath = path.join(process.cwd(), `baseline-report.${reportExtension}`);
    await this.reportGenerator.saveReport(reportContent, reportPath);
    
    // Generate SARIF output if requested
    if (sarifOutputPath) {
      core.info('📊 Generating SARIF output for GitHub Advanced Security...');
      
      // Create SARIF report generator
      const sarifGenerator = new ReportGenerator({ ...this.config.reporting, outputFormat: 'sarif' });
      const sarifContent = await sarifGenerator.generateReport(this.violations, this.summary, metadata);
      
      // Save SARIF to specified path
      const resolvedSarifPath = path.resolve(process.cwd(), sarifOutputPath);
      await sarifGenerator.saveReport(sarifContent, resolvedSarifPath);
      
      core.setOutput('sarif-path', resolvedSarifPath);
      core.info(`📊 SARIF report saved to ${resolvedSarifPath}`);
    }
    
    // Set outputs for other actions to use (always, even with zero violations)
    core.setOutput('report-path', reportPath);
    core.setOutput('violations-count', this.violations.length.toString());
    core.setOutput('compliance-score', metadata.complianceScore.toString());
    core.setOutput('has-violations', this.violations.length > 0 ? 'true' : 'false');
    // Telemetry outputs
    const scannedFileCount = (this.totalFilesScanned != null) ? this.totalFilesScanned : (this.filesAnalyzed ? this.filesAnalyzed.length : 0);
    core.setOutput('total-files-scanned', scannedFileCount.toString());
    core.setOutput('total-features-detected', this.allFeatures.length.toString());
    core.setOutput('baseline-queries-detected', (this.config.baselineQueries?.hasBaselineQueries ? 'true' : 'false'));
    if (this.config.baselineQueries?.queries) {
      core.setOutput('baseline-query-list', this.config.baselineQueries.queries.join(', '));
    }
    if (this.baselineDataManager?.lastLoadedAt) {
      core.setOutput('baseline-data-age-ms', (Date.now() - this.baselineDataManager.lastLoadedAt).toString());
      core.setOutput('baseline-data-source', this.baselineDataManager.dataSource || 'unknown');
    }
    // Files with violations
    const filesWithViolations = new Set(this.violations.map(v => v.feature.file)).size;
    core.setOutput('files-with-violations', filesWithViolations.toString());
    core.setOutput('mapping-detected-count', (metadata.mappedDetected || 0).toString());
    core.setOutput('mapping-coverage-percent', (metadata.mappingCoveragePercent || 0).toFixed(2));
    
    core.info(`📋 Report saved to ${reportPath}`);

    // Persist metadata for later (GitHub summary phase)
    this.lastReportMetadata = metadata;
  }

  /**
   * Handle results and determine action outcome
   * @returns {Promise<void>}
   */
  async handleResults() {
    const hasViolations = this.violations.length > 0;
    const enforcementMode = core.getInput('enforcement-mode') || 'error';
    const maxViolations = parseInt(core.getInput('max-violations') || '0', 10);
    
    // GitHub integration
    if (this.githubIntegration) {
      const metadata = {
        totalFeatures: this.allFeatures.length,
        totalFilesScanned: this.totalFilesScanned || (this.filesAnalyzed ? this.filesAnalyzed.length : 0),
        complianceScore: this.policyEngine.calculateComplianceScore(this.allFeatures, this.violations),
        baseline: {
          threshold: this.config.rules?.css?.['baseline-threshold'] || 'newly'
        },
        baselineQueries: this.config.baselineQueries?.queries || [],
        enforcementMode: this.config.enforcement?.mode || 'per-feature',
        // Carry over mapping stats if already computed
        mappingCoveragePercent: this.lastReportMetadata?.mappingCoveragePercent,
        mappedDetected: this.lastReportMetadata?.mappedDetected,
        mappingCount: this.baselineDataManager?.mappingCount || this.lastReportMetadata?.mappingCount || 0
      };
      
      await this.githubIntegration.processResults(
        this.violations, 
        this.summary, 
        metadata,
        '' // Report content handled separately
      );
      
      // Create workflow summary
      await this.githubIntegration.createWorkflowSummary(this.violations, this.summary, metadata);
    }
    
    // Determine if action should fail
    const shouldFail = hasViolations && (
      enforcementMode === 'error' || 
      enforcementMode === 'block' ||
      this.violations.length > maxViolations
    );
    
    if (shouldFail) {
      const message = `Baseline compliance check failed with ${this.violations.length} violation${this.violations.length !== 1 ? 's' : ''}`;
      
      // Set deterministic exit codes for CI integration
      // 0 = success (handled elsewhere)
      // 1 = general violations (no high severity)
      // 2 = at least one high severity violation
      const hasHighSeverity = this.violations.some(v => v.severity === 'high');
      let exitCode = 1;
      if (hasHighSeverity) {
        exitCode = 2;
      }

      // IMPORTANT: core.setFailed always forces exit code 1. To preserve code 2 we only use setFailed for code 1.
      if (exitCode === 2) {
        core.error(message + ' (high severity)');
        // Flush logs then exit explicitly
        process.exitCode = 2;
      } else {
        core.setFailed(message);
        process.exitCode = 1; // explicit for clarity
      }
    } else if (hasViolations && enforcementMode === 'warn') {
      core.warning(`Found ${this.violations.length} Baseline compliance violations (warnings only)`);
    } else {
      core.info('✅ Baseline compliance check passed!');
    }

    // Set exit-code output after final determination
    core.setOutput('exit-code', (process.exitCode || 0).toString());
  }

  /**
   * Handle success case (no files or no violations)
   * @returns {Promise<void>}
   */
  async handleSuccess() {
    // Set success outputs
    core.setOutput('violations-count', '0');
    core.setOutput('compliance-score', '100');
    core.setOutput('has-violations', 'false');
    core.setOutput('total-files-scanned', '0');
    core.setOutput('total-features-detected', '0');
  core.setOutput('files-with-violations', '0');
  core.setOutput('mapping-detected-count', '0');
  core.setOutput('mapping-coverage-percent', '0');
    core.setOutput('baseline-queries-detected', (this.config?.baselineQueries?.hasBaselineQueries ? 'true' : 'false'));
    if (this.config?.baselineQueries?.queries) {
      core.setOutput('baseline-query-list', this.config.baselineQueries.queries.join(', '));
    }
    if (this.baselineDataManager?.lastLoadedAt) {
      core.setOutput('baseline-data-age-ms', (Date.now() - this.baselineDataManager.lastLoadedAt).toString());
      core.setOutput('baseline-data-source', this.baselineDataManager.dataSource || 'unknown');
    }
    
    if (this.githubIntegration) {
      const metadata = {
        totalFeatures: 0,
        totalFilesScanned: 0,
        complianceScore: 100,
        baseline: {
          threshold: this.config?.rules?.css?.['baseline-threshold'] || 'newly'
        },
        baselineQueries: this.config?.baselineQueries?.queries || [],
        enforcementMode: this.config?.enforcement?.mode || 'per-feature'
      };
      
      await this.githubIntegration.processResults([], {}, metadata, '');
    }
    
    core.info('🎉 Baseline compliance check completed successfully!');
  }

  /**
   * Handle errors during execution
   * @param {Error} error - Error that occurred
   * @returns {Promise<void>}
   */
  async handleError(error) {
    core.error(`Baseline action failed: ${error.message}`);
    
    if (error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }
    
    // Set failure outputs
    core.setOutput('violations-count', '-1');
    core.setOutput('compliance-score', '0');
    core.setOutput('has-violations', 'error');
    
    // Fail the action
    core.setFailed(error.message);
  }
}

/**
 * Main execution function
 */
async function main() {
  const action = new BaselineAction();
  await action.run();
}

// Execute if this file is run directly
if (require.main === module) {
  main().catch(error => {
    core.setFailed(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = BaselineAction;