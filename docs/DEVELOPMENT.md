# Development Guide

## Project Structure Overview

This project uses a **Monorepo with Shared Core** architecture to maximize code reuse while maintaining browser extension compatibility.

### Key Architectural Decisions

1. **Shared Core as Templates**: The `packages/shared-core/` directory contains source templates for common functionality that gets copied to extension directories.

2. **File Copying vs Module Imports**: Due to browser extension security constraints, critical files are copied rather than imported as ES modules.

3. **Browser-Specific Adaptations**: Each extension has slight variations for browser APIs (`chrome.*` vs `browser.*`).

## Development Workflow

### Initial Setup

```bash
# Install all dependencies
npm install

# Verify workspace configuration
npm run build
```

### Making Changes

1. **Edit Source Files**: Make changes in `packages/shared-core/src/` for shared functionality
2. **Copy to Extensions**: Manually copy updated files to extension directories
3. **Test Both Browsers**: Load both Chrome and Firefox extensions to verify functionality

### File Synchronization

When updating shared files, ensure they're copied to the correct locations:

```bash
# Update Chrome extension
cp packages/shared-core/src/storage/secure-storage.js packages/chrome-extension/

# Update Firefox extension  
cp packages/shared-core/src/storage/secure-storage-firefox.js packages/firefox-extension/secure-storage.js
```

## Known Issues & Solutions

### ESLint Configuration

The project is configured to work with extension-specific globals and browser APIs. If you encounter linting errors:

1. Check `.eslintrc.json` for missing globals
2. Use `// eslint-disable-next-line` for legitimate cases
3. Consider if new variables need to be added to global scope

### Extension Loading Issues

**Chrome Extension**:
- Files must be in `packages/chrome-extension/` directory
- Use `chrome.*` APIs
- Manifest V3 service worker constraints

**Firefox Extension**:
- Files must be in `packages/firefox-extension/` directory  
- Use `browser.*` APIs
- Manifest V2 background script compatibility

### Import Path Problems

Extensions cannot access files outside their directory. Always copy files rather than using relative imports that cross package boundaries.

## Future Improvements

1. **Build Scripts**: Automate file copying with npm scripts
2. **Webpack/Rollup**: Bundle shared code properly for extensions
3. **Testing Framework**: Add automated tests for both browser versions
4. **CI/CD Pipeline**: Automate building and packaging for both browsers

## Troubleshooting

### Workspace Issues
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Extension Loading Issues
```bash
# Check manifest validity
npm run lint

# Verify file structure
ls -la packages/chrome-extension/
ls -la packages/firefox-extension/
```

### API Integration Problems
```bash
# Check browser console for errors
# Chrome: DevTools > Console > Service Worker logs  
# Firefox: DevTools > Console > All logs
```