# Official Baseline Queries Support

Baseline GitHub Action now supports the official Baseline queries announced in the September 16, 2025 web.dev article "Browserslist now supports Baseline".

## Supported Official Queries

### 1. Baseline Widely Available
```
# .browserslistrc
baseline widely available
```

**Auto-Configuration:**
- **Enforcement Mode:** `per-feature`
- **Baseline Threshold:** `widely`
- **Effect:** Strict enforcement for features that have been interoperable for 30+ months

### 2. Baseline Newly Available
```
# .browserslistrc
baseline newly available
```

**Auto-Configuration:**
- **Enforcement Mode:** `per-feature`
- **Baseline Threshold:** `newly`
- **Effect:** Balanced enforcement for all baseline features (≤30 months)

### 3. Baseline Year Queries
```
# .browserslistrc
baseline 2022
```

**Auto-Configuration:**
- **Enforcement Mode:** `yearly`
- **Auto-Generated Rules:** Intelligent age-based enforcement
- **Effect:** Features from 2022 and older are enforced based on age

### 4. Date-Specific Queries
```
# .browserslistrc
baseline widely available on 2024-06-06
```

**Auto-Configuration:**
- **Enforcement Mode:** `per-feature`
- **Baseline Threshold:** `widely`
- **Date Context:** Features available as of specific date

## Configuration Examples

### Example 1: Conservative Yearly Enforcement
```
# .browserslistrc
baseline 2021
```

**Generated Configuration:**
```json
{
  "enforcement": {
    "mode": "yearly",
    "baseline-query-mode": true,
    "auto-yearly-rules": {
      "2019": "error",
      "2020": "error", 
      "2021": "error",
      "2022": "warn",
      "2023": "info",
      "2024": "off"
    }
  }
}
```

### Example 2: Mixed Baseline Strategy
```
# .browserslistrc
baseline 2020
baseline 2022
baseline widely available
```

**Auto-Configuration:**
- Detects multiple year queries + widely available
- Configures yearly enforcement for 2020, 2022
- Applies strict thresholds for widely available features

### Example 3: Package.json Integration
```json
{
  "browserslist": ["baseline newly available"],
  "scripts": {
    "baseline:check": "baseline-action"
  }
}
```

## Intelligent Auto-Configuration

### Age-Based Enforcement Rules

| Feature Age | Enforcement Level | Rationale |
|-------------|------------------|-----------|
| 3+ years | `error` | Well-established, should be safe to use |
| 2-3 years | `warn` | Widely supported, minor compatibility risk |
| 1-2 years | `info` | Good support, some risk in older browsers |
| <1 year | `off` | Too new, let developers decide |

### Smart Defaults

When using official Baseline queries, the action intelligently:

1. **Detects Query Type:** Yearly, widely, newly, or date-specific
2. **Auto-Configures Enforcement:** Sets appropriate mode and thresholds
3. **Generates Rules:** Creates intelligent age-based enforcement
4. **Preserves Overrides:** Respects explicit user configuration

## Migration Examples

### From Traditional Browserslist
```
# Before
last 2 versions
> 1%
not dead

# After - Official Baseline
baseline 2022
```

### From Manual Configuration
```json
// Before - Manual yearly config
{
  "enforcement": {
    "mode": "yearly",
    "yearly-rules": {
      "2021": "error",
      "2022": "warn"
    }
  }
}
```

```
# After - Auto-configured from browserslist
baseline 2021
```

## Benefits of Official Queries

1. **Industry Standard:** Uses official web platform terminology
2. **Auto-Configuration:** Intelligent enforcement without manual setup
3. **Future-Proof:** Automatically adapts as Baseline evolves
4. **Tool Consistency:** Same queries work across Babel, PostCSS, etc.

## Advanced Usage

### Override Auto-Configuration
```json
{
  "targets": ["baseline 2022"],
  "enforcement": {
    "mode": "hybrid",
    "baseline-query-mode": true,
    "yearly-rules": {
      "2022": "warn"  // Override auto-generated "error"
    },
    "per-feature-overrides": {
      "css-has": "off"  // Disable specific features
    }
  }
}
```

### Multi-Query Strategy
```
# .browserslistrc
baseline 2021
baseline newly available
chrome >= 114
```

**Result:**
- Browser targets from all queries combined
- Auto-configuration from Baseline queries
- Comprehensive enforcement strategy

## Output Examples

### Console Output
```bash
✓ Detected official Baseline queries: baseline 2022
✓ Auto-configured yearly enforcement for years: 2022
✓ Loading browser targets from browserslist configuration
✓ Targets: chrome 120, firefox 121, safari 17...
```

### Enhanced Reporting
- **Query Detection:** Shows which official queries were found
- **Auto-Configuration:** Explains enforcement decisions
- **Browser Alignment:** Links features to query results
- **Age Analysis:** Contextualizes feature baseline dates

This makes Baseline GitHub Action the **first and only** tool to support the cutting-edge official Baseline queries announced in web.dev!