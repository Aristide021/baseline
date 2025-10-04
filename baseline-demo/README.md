# 🆕 Baseline GitHub Action Demo

**First GitHub Action to support official Baseline queries!**

This repository demonstrates the new [Baseline GitHub Action](https://github.com/Aristide021/baseline) with official Baseline queries support, as announced in the [September 16, 2025 web.dev article](https://web.dev/blog/browserslist-baseline).

## ✨ What's New

- **Official Baseline Queries**: `baseline 2022`, `baseline widely available`, `baseline newly available`
- **Auto-Configuration**: Intelligent enforcement rules generated automatically
- **Browserslist Integration**: Zero-config setup with existing browserslist configuration
- **Smart Enforcement**: Age-based rules with 4 enforcement modes

## 🚀 Quick Start

This demo uses official Baseline queries in `.browserslistrc`:

```
# .browserslistrc
baseline 2022
baseline widely available
```

The GitHub Action automatically:
1. **Detects** the official Baseline queries
2. **Auto-configures** yearly enforcement for `baseline 2022`
3. **Applies** strict thresholds for `baseline widely available`
4. **Generates** intelligent age-based rules

## 📁 Demo Structure

```
baseline-demo/
├── .browserslistrc              # Official Baseline queries
├── .github/workflows/baseline.yml # Zero-config GitHub Action
├── src/
│   ├── styles.css              # CSS features with various baseline status
│   ├── script.js               # JavaScript with ES2020+ features
│   └── index.html              # HTML showcasing modern web platform
└── README.md                   # This file
```

## 🔍 Features Tested

### ✅ Widely Available (30+ months interoperable)
- CSS Grid Layout
- CSS Custom Properties  
- Intersection Observer API
- Promise.allSettled()
- Linear gradients
- Border radius

### 🆕 Newly Available (≤30 months interoperable)
- Container Queries
- CSS `:has()` selector
- Private class fields
- Static initialization blocks
- Top-level await

### ⚠️ Age-Based Enforcement (from baseline 2022)
- `accent-color` property (2022)
- `aspect-ratio` property (2022)
- `Array.at()` method (2022)
- `Object.hasOwn()` (2022)

### 🚧 Limited/Cutting-Edge
- View Transitions API
- CSS Anchor Positioning
- Web Locks API
- Import Assertions

## 🛠️ Auto-Configuration Example

Based on our `.browserslistrc`, the action generates:

```json
{
  "enforcement": {
    "mode": "yearly",
    "baseline-query-mode": true,
    "detected-queries": ["baseline 2022", "baseline widely available"],
    "auto-yearly-rules": {
      "2020": "error",
      "2021": "error", 
      "2022": "error",
      "2023": "warn",
      "2024": "info",
      "2025": "off"
    },
    "baseline-threshold": "widely"
  }
}
```

## 📊 Expected Results

When the GitHub Action runs, you'll see:

### ✅ No Violations
- CSS Grid, Flexbox, ES6+ features
- Well-established web platform APIs

### ⚠️ Warnings
- 2023 features (accent-color in some contexts)
- Features approaching wide availability

### ❌ Errors  
- Cutting-edge features not yet in Baseline
- Features that don't meet the yearly threshold

### 📝 Informational
- 2024 features for awareness
- Context about baseline status

## 🎯 Benefits Demonstrated

1. **Zero Configuration**: Just add `.browserslistrc` with official queries
2. **Intelligent Defaults**: Auto-generated enforcement rules
3. **Industry Standard**: Uses official web platform terminology  
4. **Tool Consistency**: Same queries work across Babel, PostCSS, etc.
5. **Future-Proof**: Automatically adapts as Baseline evolves

## 🔗 Learn More

- [Baseline GitHub Action](https://github.com/Aristide021/baseline)
- [Official Baseline Queries Documentation](https://github.com/Aristide021/baseline/blob/main/examples/official-baseline-queries.md)
- [Browserslist Integration Guide](https://github.com/Aristide021/baseline/blob/main/examples/browserslist-integration.md)
- [web.dev Baseline Article](https://web.dev/blog/browserslist-baseline)

## 🎉 Try It Yourself

1. Fork this repository
2. Enable GitHub Actions
3. Push a change to trigger the workflow
4. See the auto-configured Baseline enforcement in action!

The magic happens automatically - no manual configuration required! 🪄