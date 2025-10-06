# Security Policy

## Enterprise Security Features

- **🔐 No Code Execution**: Static analysis only - never executes user code
- **🛡️ Secure Defaults**: Read-only file access with configurable patterns  
- **🔒 Token Security**: Uses standard GitHub token with minimal required permissions
- **📊 SARIF Integration**: Native GitHub Advanced Security support
- **🚫 No External Uploads**: All analysis stays within your repository

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅ Active support  |
| < 1.0   | ❌ End of life     |

## Required Permissions

**Minimal GitHub token permissions required:**
- `contents: read` - Read repository files
- `pull-requests: write` - Post compliance comments (optional)
- `checks: write` - Create status checks (optional)

**File system access:**
- Read-only access to configured file patterns
- Temporary cache directory creation (`.baseline-cache/`)
- Report output to configured paths only

## Reporting Security Issues

**For security vulnerabilities:**
- Email: security@baseline-action.dev
- Subject: "Security Vulnerability Report"
- Include: Reproduction steps, impact assessment

**For general security questions:**
- Open GitHub issue with `security` label
- Our team responds within 48 hours

## Security Considerations

### Safe Patterns
```yaml
# ✅ Safe - explicit file patterns
include-patterns: ["src/**/*.{js,css}", "public/*.html"]

# ✅ Safe - read-only reporting
output-format: "sarif"
sarif-output: "baseline-results.sarif"
```

### Avoid These Patterns
```yaml
# ❌ Avoid - overly broad patterns
include-patterns: ["**/*"]

# ❌ Avoid - system paths  
include-patterns: ["/etc/**", "/usr/**"]
```

## Compliance & Standards

- **SOC 2 Type II**: Compatible with enterprise security frameworks
- **GDPR Compliant**: No personal data collection or transmission
- **OWASP Secure**: Follows secure coding practices
- **Supply Chain**: Reproducible builds with lock files

## Third-Party Dependencies

All dependencies undergo security scanning:
- **Dependabot**: Automated vulnerability scanning
- **npm audit**: Regular dependency audits  
- **SARIF output**: Integrates with existing security tooling

## Contact

Security Team: security@baseline-action.dev  
Response Time: < 48 hours for security issues