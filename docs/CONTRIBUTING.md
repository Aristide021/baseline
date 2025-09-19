# Contributing to Baseline GitHub Action

We welcome contributions to the Baseline GitHub Action! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Architecture Overview](#architecture-overview)

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 8 or higher
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/baseline-github-action.git
   cd baseline-github-action
   ```

3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/baseline/action.git
   ```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run tests to ensure everything works:
   ```bash
   npm test
   ```

3. Build the action:
   ```bash
   npm run build
   ```

4. Run linting:
   ```bash
   npm run lint
   ```

### Development Commands

- `npm run build` - Build the action for distribution
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Code Style

### JavaScript Style Guide

We use ESLint and Prettier to enforce code style:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Line Length**: 100 characters maximum
- **Naming**: camelCase for variables and functions, PascalCase for classes

### File Organization

```
src/
├── detectors/          # Feature detection engines
├── engines/           # Policy and processing engines  
├── utils/            # Utility modules
├── data/             # Static data files
└── index.js          # Main entry point

tests/
├── detectors/        # Tests for feature detectors
├── engines/         # Tests for engines
├── utils/           # Tests for utilities
└── setup.js         # Test setup

examples/            # Example configurations and workflows
docs/               # Documentation
scripts/            # Build and utility scripts
```

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

Examples:
- `feat(detector): add support for CSS cascade layers`
- `fix(policy): handle missing feature info gracefully`
- `docs(readme): update configuration examples`

## Testing

### Test Structure

We use Jest for testing with the following structure:

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete workflows

### Writing Tests

1. Create test files alongside source files with `.test.js` suffix
2. Use descriptive test names that explain what is being tested
3. Follow AAA pattern: Arrange, Act, Assert
4. Mock external dependencies using Jest mocks
5. Test both happy path and error conditions

Example test:

```javascript
describe('CSSFeatureDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new CSSFeatureDetector();
  });

  describe('CSS Grid Detection', () => {
    it('should detect CSS Grid properties', async () => {
      // Arrange
      const css = '.container { display: grid; }';

      // Act
      const features = await detector.detectFeatures(css, 'test.css');

      // Assert
      expect(features).toHaveLength(1);
      expect(features[0]).toMatchObject({
        type: 'css-property',
        name: 'display',
        value: 'grid',
        featureId: 'css-grid'
      });
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- css-feature-detector.test.js

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

We aim for 80%+ test coverage. The CI pipeline will fail if coverage drops below this threshold.

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `npm test`
2. Ensure linting passes: `npm run lint`
3. Build successfully: `npm run build`
4. Update documentation if needed
5. Add tests for new functionality

### PR Guidelines

1. **Title**: Use clear, descriptive titles
2. **Description**: Explain what changes you made and why
3. **Link Issues**: Reference any related issues
4. **Breaking Changes**: Clearly mark any breaking changes
5. **Testing**: Describe how you tested your changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added for new functionality
```

### Review Process

1. **Automated Checks**: CI must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: Changes must be tested
4. **Documentation**: Updates must include relevant docs

## Release Process

### Versioning

We use Semantic Versioning (SemVer):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update Version**: Update version in `package.json`
2. **Update Changelog**: Document all changes
3. **Create Release**: GitHub release with tag
4. **Build Distribution**: Update `dist/` directory
5. **Update Major Version Tag**: Move v1, v2, etc. tags

### Pre-release Testing

Before major releases:
1. Test against sample repositories
2. Verify backward compatibility
3. Update documentation
4. Get community feedback

## Architecture Overview

### Core Components

1. **Feature Detectors**: Parse files and identify web platform features
   - `CSSFeatureDetector`: CSS properties, selectors, functions
   - `JSFeatureDetector`: JavaScript APIs, syntax features
   - `HTMLFeatureDetector`: HTML elements, attributes

2. **Policy Engine**: Evaluates features against Baseline policies
   - Threshold checking (limited/newly/widely)
   - Exception handling
   - Violation severity calculation

3. **Baseline Data Manager**: Manages web platform compatibility data
   - API integration with web-features database
   - Caching and performance optimization
   - Fallback data handling

4. **GitHub Integration**: Handles GitHub-specific features
   - PR comments and status checks
   - File diff analysis
   - Workflow outputs

5. **Report Generator**: Creates detailed compliance reports
   - Markdown, JSON, and HTML formats
   - Remediation suggestions
   - Performance metrics

### Data Flow

```
Files → Feature Detection → Policy Evaluation → Report Generation → GitHub Integration
  ↓           ↓                   ↓                 ↓                ↓
Cache    Feature List      Violations List    Reports        PR Comments
```

### Extension Points

To add new features:

1. **New File Types**: Add detector in `src/detectors/`
2. **New Policies**: Extend `PolicyEngine` class
3. **New Report Formats**: Extend `ReportGenerator`
4. **New Integrations**: Add to `GitHubIntegration`

### Performance Considerations

- **Caching**: File content and analysis results
- **Parallel Processing**: Multiple files simultaneously
- **Incremental Analysis**: Only changed files in PRs
- **Memory Management**: Automatic cache cleanup

## Getting Help

### Community

- **Discussions**: GitHub Discussions for questions
- **Issues**: GitHub Issues for bugs and feature requests
- **Discord**: Real-time chat with maintainers

### Documentation

- **README**: Getting started guide
- **API Docs**: Detailed API documentation
- **Examples**: Real-world usage examples
- **FAQ**: Common questions and solutions

### Maintainer Response Times

- **Issues**: Within 2-3 business days
- **PRs**: Within 1 week
- **Security Issues**: Within 24 hours

Thank you for contributing to Baseline! 🎉