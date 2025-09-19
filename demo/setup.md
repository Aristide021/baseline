# Baseline GitHub Action Demo

This demo shows the Baseline GitHub Action detecting and reporting web platform feature compatibility violations.

## Demo Repository Setup

### Test Files with Violations

**src/modern-features.css** - Contains newer CSS features:
```css
.container {
  /* CSS Container Queries - newly interoperable */
  container-type: inline-size;
  container-name: main;
}

@container main (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}

.sidebar {
  /* CSS :has() selector - limited availability */
  .parent:has(.child) {
    background: var(--highlight-color);
  }
}
```

**src/api-usage.js** - Contains modern JavaScript APIs:
```javascript
// Fetch API - newly interoperable
async function loadData() {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

// IntersectionObserver - newly interoperable
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
});

// Navigation API - limited availability
if ('navigation' in window) {
  navigation.addEventListener('navigate', (event) => {
    console.log('Navigation:', event.destination.url);
  });
}
```

**src/modern-html.html** - Contains modern HTML features:
```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <!-- Dialog element - newly interoperable -->
  <dialog id="modal">
    <p>This is a modal dialog</p>
    <button onclick="this.closest('dialog').close()">Close</button>
  </dialog>

  <!-- Details/Summary - widely available -->
  <details>
    <summary>Show more information</summary>
    <p>This content is collapsible</p>
  </details>

  <!-- Modern input types -->
  <form>
    <input type="color" name="theme-color"> <!-- newly interoperable -->
    <input type="date" name="due-date">    <!-- widely available -->
    <input type="range" min="0" max="100"> <!-- widely available -->
  </form>
</body>
</html>
```

## Expected Demo Results

With `baseline-threshold: "newly"`, this should produce:

### ❌ Violations Found:
- **CSS :has() selector** - Limited → Newly required (HIGH severity)  
- **Navigation API** - Limited → Newly required (MEDIUM severity)

### ✅ Compliant Features:
- CSS Container Queries (Newly interoperable)
- Fetch API (Newly interoperable) 
- Dialog element (Newly interoperable)
- All other features meet threshold

### Generated Report Preview:
```markdown
## ❌ Baseline Compliance Check

Found **2** features that don't meet your Baseline threshold.

### Summary
| Metric | Value |
|--------|-------|
| Total Violations | 2 |
| Compliance Score | 85% |
| High Severity | 1 🚨 |
| Medium Severity | 1 ⚠️ |

### Violations by File

#### `src/modern-features.css`
- **Line 12**: CSS :has() Selector 🚨
  - Current: 🔴 Limited
  - Required: 🟡 Newly Interoperable
  - Remediation: Use descendant selectors as fallback

#### `src/api-usage.js`
- **Line 18**: Navigation API ⚠️
  - Current: 🔴 Limited  
  - Required: 🟡 Newly Interoperable
  - Remediation: Use History API or detect support first
```

## Demo Workflow

```yaml
name: Baseline Demo
on: [push, pull_request]

jobs:
  baseline-demo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: baseline/action@v1
        with:
          baseline-threshold: newly
          enforcement-mode: error
          comment-on-pr: true
```

This demonstrates the core value proposition: **automatic detection and enforcement** of web platform feature compatibility at the CI/CD level.