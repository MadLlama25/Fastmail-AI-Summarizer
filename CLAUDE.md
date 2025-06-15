# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-browser extension that connects to Fastmail via JMAP API and uses Claude AI to summarize recent emails. Uses a **Dual Extension** architecture containing:

- **`packages/chrome-extension/`**: Chrome Manifest V3 implementation with full functionality
- **`packages/firefox-extension/`**: Firefox Manifest V2 implementation with full functionality

Both browser extensions contain identical core functionality, differing only in browser-specific APIs (`chrome.*` vs `browser.*`) and manifest requirements.

## Development Commands

### Extension Development
```bash
# Install dependencies for all packages
npm install

# Build all packages (basic validation only)
npm run build

# Lint all packages
npm run lint
```

### Chrome Extension Development
```bash
# Load extension
chrome://extensions/ → Enable "Developer mode" → "Load unpacked" → select packages/chrome-extension/

# Debug Chrome extension
# Open DevTools (F12) → Console tab → Background service logs under "Service Workers"
chrome.storage.local.get(null).then(console.log)  # Check stored data

# Package for distribution
cd packages/chrome-extension && npm run package
```

### Firefox Extension Development  
```bash
# Load extension
about:debugging → "This Firefox" → "Load Temporary Add-on" → select packages/firefox-extension/manifest.json

# Debug Firefox extension
# Open DevTools (F12) → All logs appear in main browser console
browser.storage.local.get().then(console.log)  # Check stored data

# Package for distribution
cd packages/firefox-extension && npm run package
```

### API Configuration Requirements
- **Fastmail API Token**: Settings > Privacy & Security > API Tokens (Mail read permissions)
- **Claude API Key**: console.anthropic.com (starts with `sk-ant-`)
- **Development Testing**: Start with 5 emails to verify API connectivity

## Core Architecture

### Dual Extension Architecture
- **Chrome Extension (`packages/chrome-extension/`)**: Manifest V3, `chrome.*` APIs, Service Worker
  - Complete implementation with secure-storage.js, popup, background service
  - Uses Service Worker for background processing
- **Firefox Extension (`packages/firefox-extension/`)**: Manifest V2, `browser.*` APIs, traditional background script
  - Complete implementation with secure-storage.js, popup, background service
  - Uses traditional background script (non-persistent)
- **Code Synchronization**: Changes made to one extension should be manually ported to the other

### Security & Encryption Architecture
- `SecureStorage` class provides AES-GCM encryption with password-derived keys
- **SECURITY ENHANCED**: No master keys stored in browser storage - uses extension ID + deterministic salt
- API tokens encrypted with PBKDF2 (600,000 iterations) before storage
- **SECURITY FIX**: Removed backwards compatibility fallback that bypassed encryption

### Message Passing Architecture
- **Chrome**: `chrome.runtime.sendMessage()` to Service Worker
- **Firefox**: `browser.runtime.sendMessage()` to background script  
- Five main actions: `authenticate`, `setApiToken`, `getMailboxes`, `summarizeEmails`, `chatWithAI`
- **Enhanced Chat**: `chatWithAI` supports both basic mode (summary data) and enhanced mode (real-time Fastmail API access)
- All API tokens passed as encrypted strings between popup and background contexts

### Authentication & API Flow
1. User configures API tokens via modal overlay (⚙️ settings gear)
2. Tokens encrypted using `SecureStorage.encryptToken()` before storage
3. Background context decrypts tokens for API calls
4. `FastmailJMAP.authenticate()` establishes JMAP session
5. `getMailboxes()` fetches available folders for selection
6. `getRecentEmails()` fetches with `fetchTextBodyValues: true` and optional folder filtering
7. `ClaudeAPI.summarizeEmails()` processes via Claude 3.5 Haiku with priority email highlighting
8. **Enhanced Chat**: `ClaudeAPI.chatWithFastmailAPI()` uses function calling for real-time email search and analysis

### UI Architecture & State Management
- **Primary Interface**: Large summarize button disabled until authentication complete
- **Multi-Folder Selection**: Checkbox-based interface allowing multiple folder selection simultaneously
- **Hierarchical Folder Display**: Shows parent/child relationships with visual tree indicators (e.g., "Work / Projects")
- **Selection Summary**: Dynamic display showing current selection ("All Folders", "Inbox", or "3 folders selected")
- **Configuration Modal**: Hidden behind ⚙️ gear icon, auto-opens when API keys missing
- **Progressive Disclosure**: Settings appear only when needed, auto-close after successful auth
- **Connection Status**: Real-time visual indicators (red/green dots) showing Fastmail connectivity
- **Summary Display**: Animated presentation with metadata, action buttons (copy, print, text size)
- **Enhanced Chat Interface**: Dual-mode chat system with Basic/Enhanced mode toggle and improved formatting
  - **Basic Mode**: Chat about summarized emails using stored `currentEmailData`
  - **Enhanced Mode**: Real-time Fastmail API integration with Claude function calling
  - **Mode Toggle**: Checkbox to switch between modes, auto-enables Enhanced Mode if no summary data available
  - **Rich Text Formatting**: Comprehensive markdown-to-HTML conversion with headers, lists, code blocks, and improved readability
  - **Enhanced Typography**: Increased chat message font size from 11px to 13px for better readability
- **Interactive Chat**: Chat interface below summary for asking questions about emails

## Critical Implementation Details

### JMAP Email Retrieval with Multi-Folder Filtering & Priority Sorting
```javascript
// Mailbox/get with hierarchical properties for folder tree display
properties: ['id', 'name', 'role', 'parentId', 'sortOrder']

// Email/query with multi-folder filtering using OR operations
if (Array.isArray(mailboxIds) && mailboxIds.length > 1) {
  filter = {
    operator: 'OR',
    conditions: validIds.map(id => ({ inMailbox: id }))
  };
}
// Email/get includes keywords property for priority detection
properties: ['id', 'subject', 'from', 'to', 'receivedAt', 'textBody', 'htmlBody', 'bodyValues', 'keywords']
// Priority sorting: flagged/important emails first, then by date
return this.sortEmailsByPriority(emails);
```

### JMAP Email Body Retrieval Pattern
```javascript
// Prioritizes textBody over htmlBody, handles bodyValues properly
if (email.textBody && email.textBody.length > 0) {
  const bodyPart = email.textBody[0];
  if (bodyPart.partId && email.bodyValues[bodyPart.partId]) {
    return email.bodyValues[bodyPart.partId].value;
  }
}
// Falls back to separate Email/get calls if bodyValues not in initial response
```

### Priority Email Detection & Processing
```javascript
// Detects priority emails via JMAP keywords
isHighPriorityEmail(email) {
  const priorityKeywords = ['$flagged', '$important', 'important', 'urgent'];
  return priorityKeywords.some(keyword => email.keywords[keyword] === true);
}
// Adds [PRIORITY] markers for Claude API processing
const priorityFlag = isPriority ? '[PRIORITY] ' : '';
```

### Claude API Integration Requirements
- Uses `claude-3-5-haiku-20241022` model with `anthropic-dangerous-direct-browser-access: true` header
- **Priority Email Handling**: Emails marked with `[PRIORITY]` are highlighted prominently in summaries
- Enhanced prompt instructs Claude to use **bold formatting** for priority emails and mention them first
- Formats email data as structured text with subject, sender, date, body content
- Strips HTML tags from HTML bodies for plain text summarization

### Enhanced Chat with Function Calling
- **Claude Function Calling**: Uses Claude's tools API for real-time email interaction
- **Available Functions**:
  - `search_emails`: Search by sender, subject, date range, keywords, JMAP keywords, or mailbox
  - `get_mailboxes`: List all available mailboxes/folders with metadata
  - `get_email_details`: Get full details of specific emails by ID array
- **Function Implementation**: Each function uses FastmailJMAP methods (`searchEmails`, `getMailboxes`, `getEmailsByIds`)
- **Error Handling**: Comprehensive error handling for API failures, authentication issues, and malformed data
- **Response Processing**: Iterative function calling with tool results fed back to Claude for contextual responses

### Browser API Compatibility Layer
- **Chrome**: `chrome.storage.local`, `chrome.runtime`, Service Worker context
- **Firefox**: `browser.storage.local`, `browser.runtime`, traditional background script
- **Manifest Differences**: V3 vs V2, `action` vs `browser_action`, different permission formats

## Security Considerations

### Security Enhancements Applied
1. **✅ Password-Derived Encryption**: Extension ID + deterministic salt used instead of stored master keys
2. **✅ Strong PBKDF2**: Upgraded to 600,000 iterations (meets modern standards)
3. **✅ Removed Bypass Fallback**: Eliminated base64 decoding that bypassed encryption
4. **✅ Minimal Permissions**: Removed unnecessary `activeTab` and `tabs` permissions
5. **✅ No Data Leakage**: Removed all console logging of sensitive information
6. **✅ XSS Protection**: Secure HTML sanitization with formatting preservation via `formatSummaryTextSecurely()`
7. **✅ Enhanced Firefox CSP**: Added comprehensive Content Security Policy

### Current Security Architecture
- API tokens encrypted with AES-GCM using password-derived keys
- Deterministic salt generation from extension ID (no storage required)
- 600,000 PBKDF2 iterations for strong key derivation
- No sensitive data logging in any context
- Minimal required permissions (storage + API endpoints only)

## Development Workflow

### Testing Both Browser Versions
1. Test Chrome version first (packages/chrome-extension/)
2. Test Firefox version second (packages/firefox-extension/)  
3. Verify identical functionality across both browsers
4. Check both DevTools consoles for browser-specific errors

### Configuration Testing Pattern
1. Start with 5 emails to verify API connectivity
2. Test authentication flow: modal open → tokens enter → connection status → modal close
3. Test multi-folder selection: verify checkbox interface populates with hierarchical folder display
4. Test folder hierarchy: verify parent/child relationships show correctly (e.g., "Work / Projects")
5. Test selection logic: verify "All Folders" vs specific folder selection behavior
6. Test multi-folder filtering: select multiple folders and verify emails from all selected folders appear
7. Test priority emails: flag some emails in Fastmail and verify they appear first with **bold formatting**
8. Test error handling: empty mailbox accounts, invalid folder IDs, malformed email dates
9. Verify summary display with metadata and action buttons (uses secure HTML sanitization for XSS protection while preserving formatting)
10. Test error states: missing tokens, invalid tokens, API failures, folder loading failures
11. **Enhanced Chat Testing**:
    - Test Basic Mode: Generate summary, then chat about summarized emails
    - Test Enhanced Mode: Toggle enhanced mode and search entire mailbox
    - Test mode switching: Verify toggle between Basic and Enhanced modes works correctly
    - Test function calling: Verify Claude can search emails, get mailboxes, and retrieve email details
    - Test error handling: Invalid searches, malformed queries, API failures
    - Test chat formatting: Verify markdown formatting works (headers, lists, bold/italic, code blocks)
    - Test typography: Verify improved readability with larger chat text size (13px)
12. **IMPORTANT**: Test with fresh tokens - legacy base64 tokens will require re-entry

### Common Development Issues
- **Firefox**: Ensure using `browser.*` APIs, not `chrome.*`
- **Chrome**: Service Worker context differences from traditional background scripts
- **Multi-Folder Selection**: Checkbox event handling requires proper propagation and state management
- **Hierarchy Building**: Parent/child relationships must handle missing parents gracefully
- **JMAP OR Filtering**: Multiple mailbox filtering uses OR operator with conditions array
- **Security**: Use `sanitizeHtml()` method for user content display - escapes HTML then applies safe formatting
- **Encryption**: Extension ID fallbacks required for both `chrome.runtime.id` and `browser.runtime.id`
- **Permissions**: Manifest V2 vs V3 permission format differences
- **Error Handling**: Extension gracefully handles empty mailboxes, invalid dates, and malformed data
- **User Feedback**: UI shows "Unable to load folders" or "No folders available" for error states
- **Legacy Tokens**: Users upgrading will need to re-enter API tokens (security improvement)
- **Enhanced Chat Mode**: Ensure `useEnhancedMode` parameter is correctly passed to background scripts
- **Function Calling**: Verify Claude function definitions match FastmailJMAP method signatures
- **Chat Mode Toggle**: Test that Enhanced Mode checkbox state is properly read and handled
- **API Rate Limits**: Enhanced Mode may trigger more JMAP API calls - handle rate limiting gracefully
- **Chat Formatting**: Use `formatMarkdownToHtml()` method for consistent markdown-to-HTML conversion
- **Typography Consistency**: Ensure chat messages use 13px font size while preserving 11px for UI elements
- **Markdown Processing**: Verify line-by-line processing for proper list and paragraph handling