# 🚀 Live Demo - Baseline GitHub Action

**Ready to test in 30 seconds?** This demo showcases our dual scenario system for hackathon judges.

## Quick Demo Setup

### 1. Fork & Run Workflow

```bash
# Fork this repo, then:
gh workflow run "Baseline Demo Workflow" --repo YOUR_USERNAME/baseline
```

### 2. View Live Results

The demo runs **two parallel scenarios**:

- **🔴 Enforcement Demo**: Finds 3 CSS violations (backdrop-filter, container queries)
- **✅ Passing Demo**: Shows clean compliance with smart exceptions

### 3. Key Differentiators

**🆕 First GitHub Action supporting official Baseline queries:**
```yaml
# These just work automatically:
enforcement-mode: "baseline 2022"
enforcement-mode: "baseline widely available" 
enforcement-mode: "baseline newly available"
```

**🎯 Enterprise CI/CD Integration:**
- Deterministic exit codes (0/1/2) for scripting
- SARIF output for GitHub Advanced Security
- 86.3% feature mapping coverage with alias resolution

**⚡ Zero-Config Auto-Setup:**
- Detects browserslist → auto-configures thresholds
- Scans only changed files (auto/diff/repo modes)
- Caches Baseline data for 50x faster runs

## Try It Yourself

### Option A: Test Against Your Repo
```yaml
- uses: Aristide021/baseline@main
  with:
    enforcement-mode: 'warn'  # Safe first run
    baseline-threshold: 'newly'
```

### Option B: Local CLI Test
```bash
npx @baseline/github-action scan --mode=repo --threshold=newly
```

## Expected Demo Output

**Enforcement Scenario (violations found):**
```
❌ 3 Baseline violations found
• backdrop-filter: newly → widely required
• container-queries: limited → newly required  
• css-nesting: newly → widely required
```

**Passing Scenario (clean compliance):**
```
✅ All Clear - 0 violations found
📊 Scanned 2 files, detected 5 features
🎯 86.3% mapping coverage achieved
```

## Next Steps for Judges

1. **Review workflow results** in Actions tab
2. **Check PR comments** for detailed reports  
3. **Explore SARIF integration** in Security tab
4. **Test custom thresholds** in your own repos

**Ready for production?** → See [examples/](examples/) for advanced configurations