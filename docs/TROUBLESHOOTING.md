# Troubleshooting Guide

This guide helps you resolve common issues when using the Baseline GitHub Action.

## Table of Contents

- [Common Issues](#common-issues)
- [Configuration Problems](#configuration-problems)
- [Performance Issues](#performance-issues)
- [API and Network Issues](#api-and-network-issues)
- [GitHub Integration Issues](#github-integration-issues)
- [Debugging](#debugging)
- [Getting Help](#getting-help)

## Common Issues

### Action Fails with "No files to analyze"

**Problem:** The action completes successfully but reports no files were analyzed.

**Causes:**
- File patterns don't match any files
- All matching files are excluded by ignore patterns
- Working directory is not set correctly

**Solutions:**

1. Check your include patterns:
   ```yaml
   - uses: baseline/action@v1
     with:
       include-patterns: '**/*.{js,jsx,ts,tsx,css,scss,html}'
   ```

2. Verify exclude patterns aren't too broad:
   ```yaml
   - uses: baseline/action@v1
     with:
       exclude-patterns: 'node_modules/**,dist/**'
   ```

3. List files to debug patterns:
   ```yaml
   - name: Debug file patterns
     run: |
       echo "Files matching pattern:"
       find . -name "*.js" -o -name "*.css" | head -10
   ```

### "Configuration validation failed" Error

**Problem:** Action fails during configuration loading with validation errors.

**Common validation errors:**

1. **Invalid threshold value:**
   ```
   Error: Invalid CSS baseline threshold: strict
   ```
   **Fix:** Use valid values: `limited`, `newly`, or `widely`

2. **Invalid max-violations:**
   ```
   Error: max-violations must be a non-negative number
   ```
   **Fix:** Use a number ≥ 0

3. **Invalid severity weights:**
   ```
   Error: Severity weight for high must be a number between 0 and 1
   ```
   **Fix:** Use values between 0.0 and 1.0

**Debug configuration:**
```yaml
- name: Debug configuration
  run: |
    cat .baseline.json
    echo "Action inputs:"
    echo "threshold: ${{ github.event.inputs.baseline-threshold }}"
```

### False Positives in Feature Detection

**Problem:** Action reports features that aren't actually used or are in comments.

**Common causes:**
- Features mentioned in comments
- Dead code that isn't executed
- Feature names in strings

**Solutions:**

1. Add exceptions for specific files:
   ```json
   {
     "rules": {
       "css": {
         "allowed-exceptions": [
           {
             "feature": "css-container-queries",
             "files": ["docs/**", "examples/**"],
             "reason": "Documentation examples"
           }
         ]
       }
     }
   }
   ```

2. Exclude documentation files:
   ```yaml
   - uses: baseline/action@v1
     with:
       exclude-patterns: 'docs/**,*.md,examples/**'
   ```

### PR Comments Not Appearing

**Problem:** Action runs successfully but doesn't post PR comments.

**Troubleshooting steps:**

1. **Check permissions:**
   ```yaml
   permissions:
     contents: read
     issues: write
     pull-requests: write
   ```

2. **Verify token:**
   ```yaml
   - uses: baseline/action@v1
     with:
       github-token: ${{ secrets.GITHUB_TOKEN }}
       comment-on-pr: true
   ```

3. **Check event type:**
   ```yaml
   on:
     pull_request:  # Required for PR comments
       types: [opened, synchronize]
   ```

## Configuration Problems

### Configuration File Not Found

**Problem:** Action uses default configuration instead of your `.baseline.json`.

**Debug steps:**

1. **Verify file location:**
   ```bash
   ls -la .baseline.json
   ```

2. **Check file syntax:**
   ```bash
   cat .baseline.json | jq .
   ```

3. **Specify custom path:**
   ```yaml
   - uses: baseline/action@v1
     with:
       config-path: 'config/baseline.json'
   ```

### Configuration Override Not Working

**Problem:** GitHub Action inputs don't override configuration file values.

**Explanation:** Configuration precedence (highest to lowest):
1. Environment variables
2. GitHub Action inputs
3. package.json baseline field
4. Configuration file (.baseline.json)
5. Default configuration

**Solution:** Use environment variables for highest precedence:
```yaml
env:
  BASELINE_THRESHOLD: widely
- uses: baseline/action@v1
```

## Performance Issues

### Action Times Out

**Problem:** Action exceeds GitHub's job timeout limit.

**Solutions:**

1. **Enable caching:**
   ```yaml
   - uses: actions/cache@v4
     with:
       path: .baseline-cache
       key: baseline-${{ hashFiles('.baseline.json') }}
   ```

2. **Analyze only changed files:**
   ```yaml
   - uses: baseline/action@v1
     with:
       fail-on-new-only: true
   ```

3. **Reduce file scope:**
   ```yaml
   - uses: baseline/action@v1
     with:
       include-patterns: 'src/**/*.{js,css}'
       exclude-patterns: 'src/vendor/**,**/*.min.{js,css}'
   ```

### High Memory Usage

**Problem:** Action fails with out-of-memory errors.

**Solutions:**

1. **Process files in batches:**
   ```json
   {
     "performance": {
       "maxConcurrentFiles": 5,
       "memoryThreshold": "50MB"
     }
   }
   ```

2. **Exclude large generated files:**
   ```yaml
   - uses: baseline/action@v1
     with:
       exclude-patterns: 'dist/**,build/**,**/*.min.js'
   ```

## API and Network Issues

### "Failed to fetch Baseline data" Error

**Problem:** Action can't connect to the Baseline API.

**Troubleshooting:**

1. **Check network connectivity:**
   ```yaml
   - name: Test API connectivity
     run: curl -I https://api.webstatus.dev/v1/features
   ```

2. **Use fallback data:**
   The action should automatically fall back to cached data, but you can force it:
   ```yaml
   env:
     BASELINE_USE_FALLBACK: true
   ```

3. **Configure proxy if needed:**
   ```yaml
   env:
     HTTP_PROXY: http://proxy.company.com:8080
     HTTPS_PROXY: http://proxy.company.com:8080
   ```

### Rate Limiting Issues

**Problem:** API requests are being rate limited.

**Solutions:**

1. **Enable caching:**
   ```yaml
   - uses: actions/cache@v4
     with:
       path: .baseline-cache
       key: baseline-data-${{ hashFiles('package-lock.json') }}
       restore-keys: baseline-data-
   ```

2. **Reduce API calls:**
   ```yaml
   - uses: baseline/action@v1
     with:
       fail-on-new-only: true  # Only check changed files
   ```

## GitHub Integration Issues

### Status Checks Not Appearing

**Problem:** GitHub status checks don't show up in the PR.

**Solutions:**

1. **Enable status checks:**
   ```yaml
   - uses: baseline/action@v1
     with:
       create-status-check: true
       status-check-name: "Baseline Compliance"
   ```

2. **Check workflow permissions:**
   ```yaml
   permissions:
     contents: read
     checks: write
     statuses: write
   ```

### Workflow Summary Not Generated

**Problem:** GitHub workflow summary is empty or missing.

**Debug:**
```yaml
- name: Debug summary
  run: |
    echo "GITHUB_STEP_SUMMARY: $GITHUB_STEP_SUMMARY"
    ls -la $GITHUB_STEP_SUMMARY || echo "Summary file not found"
```

**Solution:** Ensure workflow has write permissions:
```yaml
permissions:
  contents: read
  actions: write
```

## Debugging

### Enable Debug Logging

Add debug logging to troubleshoot issues:

```yaml
- uses: baseline/action@v1
  env:
    ACTIONS_STEP_DEBUG: true
  with:
    # Your configuration
```

### Debug Configuration Loading

```yaml
- name: Debug configuration
  run: |
    echo "=== Package.json ==="
    cat package.json | jq '.baseline // empty'
    echo "=== Baseline config ==="
    cat .baseline.json || echo "No .baseline.json found"
    echo "=== Environment ==="
    env | grep BASELINE || echo "No BASELINE env vars"
```

### Debug File Processing

```yaml
- name: Debug files
  run: |
    echo "=== Working directory ==="
    pwd
    echo "=== Files to analyze ==="
    find . -name "*.js" -o -name "*.css" -o -name "*.html" | grep -v node_modules | head -20
    echo "=== File stats ==="
    find . -name "*.js" | wc -l
    find . -name "*.css" | wc -l
    find . -name "*.html" | wc -l
```

### Capture Action Outputs

```yaml
- uses: baseline/action@v1
  id: baseline
  # ... configuration ...

- name: Debug outputs
  run: |
    echo "Violations: ${{ steps.baseline.outputs.violations-count }}"
    echo "Score: ${{ steps.baseline.outputs.compliance-score }}"
    echo "Has violations: ${{ steps.baseline.outputs.has-violations }}"
```

### Local Testing

Test the action locally using act:

```bash
# Install act
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act pull_request -j baseline-check
```

## Getting Help

### Before Asking for Help

Please gather this information:

1. **Action version:** Which version/tag are you using?
2. **Configuration:** Your `.baseline.json` and workflow YAML
3. **Error messages:** Complete error messages and stack traces
4. **Environment:** GitHub hosted runners or self-hosted?
5. **Repository:** Is it public? Can you share a link?

### Debug Information Script

```yaml
- name: Collect debug information
  if: failure()
  run: |
    echo "=== System Information ==="
    node --version
    npm --version
    echo "OS: $(uname -a)"
    echo "=== Repository Information ==="
    git status
    git log --oneline -5
    echo "=== Action Configuration ==="
    cat .baseline.json || echo "No config file"
    echo "=== Environment Variables ==="
    env | grep -E "(GITHUB_|BASELINE_|NODE_)" | sort
    echo "=== File System ==="
    ls -la
    find . -name "*.js" | wc -l
    find . -name "*.css" | wc -l
    echo "=== Recent logs ==="
    tail -50 .baseline-cache/errors.log || echo "No error log"
```

### Support Channels

1. **GitHub Issues:** For bugs and feature requests
2. **GitHub Discussions:** For questions and community help
3. **Stack Overflow:** Tag questions with `baseline-github-action`

### Issue Template

When creating issues, use this template:

```markdown
## Description
Brief description of the issue

## Configuration
```yaml
# Your workflow configuration
```

```json
// Your .baseline.json configuration
```

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Environment
- Action version: v1.x.x
- Runner: ubuntu-latest / self-hosted
- Repository: public / private

## Logs
```
Paste relevant log output here
```

## Additional Context
Any other context about the problem
```

This troubleshooting guide should help resolve most common issues. If you encounter a problem not covered here, please open an issue with detailed information about your setup and the error you're experiencing.