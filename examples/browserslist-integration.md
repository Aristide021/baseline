# Browserslist Integration

Baseline GitHub Action automatically integrates with existing [browserslist](https://github.com/browserslist/browserslist) configuration in your project.

## Priority Order

1. **Explicit targets** in `baseline.config.json`
2. **Browserslist configuration** (`.browserslistrc` or `package.json`)
3. **Default fallback** behavior

## Configuration Examples

### Using .browserslistrc

```
# .browserslistrc
last 2 versions
> 1%
not dead
not ie 11
```

### Using package.json

```json
{
  "name": "my-project",
  "browserslist": [
    "chrome >= 114",
    "edge >= 114", 
    "firefox >= 115",
    "safari >= 17",
    "ios_saf >= 17"
  ]
}
```

### Explicit Override

```json
{
  "targets": ["chrome >= 120", "firefox >= 120"],
  "enforcement": {
    "mode": "yearly"
  }
}
```

When both exist, explicit `targets` in `baseline.config.json` take precedence over browserslist.

## Benefits

- **Zero Configuration**: Reuse existing browserslist setup
- **Team Consistency**: Same browser targets across all tools
- **Easy Migration**: Existing projects work immediately
- **Flexible Override**: Can still specify custom targets when needed

## Browserslist Sources

Browserslist automatically detects configuration from:

1. `.browserslistrc` file
2. `browserslist` field in `package.json`
3. `BROWSERSLIST` environment variable
4. Default queries if none found

## Example Output

```bash
# With browserslist integration
✓ Loading browser targets from browserslist configuration
✓ Targets: chrome 114, chrome 115, firefox 115, safari 17
✓ Configuration loaded successfully
```

## Migration Path

### Existing browserslist project
1. Add Baseline GitHub Action to workflow
2. No additional configuration needed
3. Action uses existing browser targets

### Add yearly enforcement
1. Create `baseline.config.json`:
```json
{
  "enforcement": {
    "mode": "yearly",
    "yearly-rules": {
      "2022": "error",
      "2023": "warn", 
      "2024": "info"
    }
  }
}
```
2. Browserslist targets automatically inherited
3. Get yearly enforcement with existing browser support