# Fastmail Email Summarizer Firefox Extension

## Overview
Firefox version of the Fastmail Email Summarizer with multi-folder selection, hierarchical folder display, priority email highlighting, and enhanced security. For complete feature details, see the [main README](../README.md).

## Key Differences from Chrome Version
- **Manifest V2** (Firefox's current standard)
- `browser.*` APIs instead of `chrome.*`
- Traditional background script, not a service worker
- `browser_action` instead of `action` in manifest

## Quick Setup
**Prerequisites**: Fastmail API token + Claude API key (see [main README](../README.md) for details)

## Installation
1. Open `about:debugging` in Firefox
2. Click "This Firefox" → "Load Temporary Add-on"
3. Select `Firefox/manifest.json` from the repository
4. Configure API tokens via ⚙️ settings (same as Chrome version)

**Usage**: Identical to Chrome version - select multiple folders with checkboxes, view hierarchical folder structure, choose email count, and summarize!

## Firefox-Specific Notes

### Installation Type
- **Temporary Extension**: Loaded via `about:debugging` (disappears after restart)
- **All functionality identical to Chrome version**

### Development
- Uses `browser.*` APIs (vs Chrome's `chrome.*`)
- Enhanced Content Security Policy
- Same security and features as Chrome version

## Troubleshooting

### Firefox-Specific Issues
1. **Extension not loading**: Select the `manifest.json` file, not folder
2. **"browser is not defined"**: Ensure you're using Firefox version, not Chrome
3. **Extension disappeared**: Reload via `about:debugging` after Firefox restart

### Common Issues
See [main README troubleshooting section](../README.md#troubleshooting) for complete guidance.

### Development
- Use Firefox DevTools (F12) for debugging
- Check storage: `browser.storage.local.get().then(console.log)`
- Background logs appear in main browser console