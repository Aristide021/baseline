# Simple Baseline Demo - CSS Container Queries Focus

## 🎯 Focused Demonstration: CSS Container Queries

This demo focuses specifically on **CSS Container Queries** - a perfect example of the "newly interoperable" category that teams are unsure about adopting.

### The Problem
Developers see Container Queries in articles and tutorials but don't know:
- Is it safe to use in production?
- What's the browser support?
- Do we need fallbacks?

### The Solution: Baseline Action

## Demo Setup

**styles.css** - Using Container Queries without fallback:
```css
.sidebar {
  /* This will trigger a violation if threshold is "widely" */
  container-type: inline-size;
  container-name: sidebar;
}

@container sidebar (min-width: 300px) {
  .widget {
    display: flex;
    gap: 1rem;
  }
}
```

**.baseline.json** - Configuration:
```json
{
  "rules": {
    "css": {
      "baseline-threshold": "widely"
    }
  }
}
```

## Demo Results

### With threshold "widely" (strict):
```
❌ Baseline Compliance Check Failed

Found 1 violation:

📁 styles.css (line 3)
🚨 CSS Container Queries
   Current: 🟡 Newly Interoperable (Feb 2023)
   Required: 🟢 Widely Available
   
🛠️ Remediation:
   - Use media queries as fallback
   - Consider @supports detection
   - Polyfill: container-query-polyfill
   
📖 Learn more: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Container_Queries
```

### With threshold "newly" (balanced):
```
✅ Baseline Compliance Check Passed

CSS Container Queries meets "newly interoperable" threshold.
Safe to use with progressive enhancement.
```

## Key Value Demonstrated

1. **Automatic Detection**: No manual checking needed
2. **Policy Enforcement**: Team-wide standards, not individual decisions  
3. **Actionable Guidance**: Specific remediation steps
4. **Threshold Flexibility**: Adjust based on project requirements

## 3-Minute Demo Script

1. **Problem Setup** (30s): Show developer uncertainty about Container Queries
2. **Action Configuration** (30s): Simple .baseline.json setup
3. **Policy Violation** (60s): Demonstrate "widely" threshold failure with detailed output
4. **Policy Pass** (30s): Show "newly" threshold success
5. **Value Proposition** (30s): Organizational policy enforcement vs individual guessing

This focused demo clearly shows the core innovation: **turning Baseline from information into enforcement**.