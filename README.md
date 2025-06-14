# Fastmail Email Summarizer

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](chrome://extensions/)
[![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-orange?logo=firefox)](about:debugging)
[![Fastmail](https://img.shields.io/badge/Fastmail-JMAP-red?logo=fastmail)](https://www.fastmail.com/)
[![Claude AI](https://img.shields.io/badge/Claude-AI-orange?logo=anthropic)](https://www.anthropic.com/)

## Overview

A cross-browser extension that connects to your Fastmail account using JMAP API tokens, fetches your recent emails, and summarizes them using Claude AI. Built with a **Monorepo with Shared Core** architecture for maximum code reuse and maintainability across Chrome and Firefox.

## Features

- 🔐 **Enhanced Security** - AES-GCM encryption with 600,000 PBKDF2 iterations, no master keys stored
- 📧 **JMAP Integration** - Direct connection to Fastmail using modern JMAP protocol
- 🤖 **Claude AI Summaries** - Powered by Claude 3.5 Haiku for fast, high-quality summaries
- 📁 **Multi-Folder Selection** - Select multiple folders simultaneously or choose "All Folders"
- 🌳 **Hierarchical Folder Display** - Shows parent/child folder relationships (e.g., "Work / Projects")
- ⭐ **Priority Email Highlighting** - Automatically prioritizes flagged/important emails in summaries
- ⚙️ **Configurable Email Count** - Summarize 5, 10, 15, 20, or 30 recent emails
- 🎨 **Modern UI** - Clean interface with animated summary display and rich text formatting
- 📋 **Action Buttons** - Copy to clipboard, print, and text size adjustment
- 🔄 **Real-time Status** - Visual connection indicators and smart error handling

## Prerequisites

### 1. Fastmail API Token
- Log in to your Fastmail account
- Go to Settings > Privacy & Security > API Tokens
- Create a new API token with **Mail read permissions**
- Copy the token - you'll need it for the extension setup

### 2. Claude API Key
- Sign up for an Anthropic account at https://console.anthropic.com
- Generate an API key (starts with `sk-ant-`)
- Keep this key secure and don't share it

### 3. Chrome Developer Mode
- Open Chrome and go to `chrome://extensions/`
- Toggle "Developer mode" in the top right corner
- You'll use this to load the extension

## Installation

### Step 1: Install Dependencies and Build
1. Download or clone this repository to your computer
   ```bash
   git clone <repository-url>
   cd fastmail-email-summarizer
   npm install
   ```

### Step 2: Load Chrome Extension
1. Open `chrome://extensions/` in Chrome
2. Ensure "Developer mode" is enabled (top right)
3. Click "Load unpacked" and select `packages/chrome-extension/`
4. The extension should appear in your Chrome toolbar with a mail envelope icon (📧)

### Step 3: Load Firefox Extension (Optional)
1. Open `about:debugging` in Firefox
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `packages/firefox-extension/manifest.json`

### Step 4: Configure API Tokens
1. Click the mail envelope extension icon in Chrome toolbar
2. In the popup window, click the **⚙️ Settings** gear icon in the top-right corner
3. In the configuration modal that opens:
   - Enter your **Fastmail API token** in the first field
   - Enter your **Claude API key** in the second field
   - Click "🔐 Connect to Fastmail" button
4. Wait for successful connection - you'll see:
   - Green dot indicator showing "Connected to Fastmail" 
   - Modal will automatically close after successful connection

### Step 5: Summarize Emails
1. Back in the main popup, choose your options:
   - **Folders**: Select multiple folders using checkboxes, or choose "All Folders" 
   - **Hierarchical Display**: See full folder paths for nested folders (e.g., "Work / Projects")
   - **Email Count**: Choose 5, 10, 15, 20, or 30 emails to summarize
2. Click the large "📝 Summarize Recent Emails" button
3. View the AI-generated summary with professional formatting and metadata
4. **Priority emails** (flagged/important) will appear first with **bold formatting**

## User Interface

### Main Interface
- **Clean layout** with prominent summarize button, multi-folder selection, and email count selector
- **Multi-folder selection** - checkbox interface to select multiple folders simultaneously
- **Hierarchical folder display** - shows parent/child relationships with visual tree indicators
- **Selection summary** - displays current folder selection ("All Folders", "Inbox", or "3 folders selected")
- **Smart error handling** - automatically opens settings if API keys are missing
- **Real-time status** - button is disabled until properly configured

### Configuration Modal
- **Hidden by default** - accessed via settings gear icon (⚙️)
- **Professional overlay** with backdrop blur and easy close options
- **Connection status** with visual indicators (red/green dots)

### Summary Display
- **Animated presentation** with slide-in effects and enhanced styling
- **Priority email highlighting** - flagged/important emails appear first with **bold formatting**
- **Rich formatting** with bold, italics, bullet points, numbered lists (securely sanitized)
- **Comprehensive metadata** showing generation time, email count, AI model, and selected folder
- **Action buttons** for copy to clipboard, print, and text size adjustment

## Project Structure

```
fastmail-email-summarizer/
├── packages/
│   ├── shared-core/                 # Common functionality
│   │   ├── src/
│   │   │   ├── storage/            # Secure encryption utilities
│   │   │   ├── api/                # Fastmail JMAP & Claude API clients
│   │   │   ├── utils/              # HTML sanitization & utilities
│   │   │   └── index.js            # Main exports
│   │   └── package.json
│   ├── chrome-extension/           # Chrome Manifest V3
│   │   ├── manifest.json
│   │   ├── popup-html.html
│   │   ├── popup-js.js
│   │   ├── secure-storage.js       # Copied from shared-core
│   │   ├── fastmail-background-service.js
│   │   └── package.json
│   └── firefox-extension/          # Firefox Manifest V2
│       ├── manifest.json
│       ├── popup-html.html
│       ├── popup-js.js
│       ├── secure-storage.js       # Copied from shared-core (Firefox version)
│       ├── fastmail-background-service.js
│       └── package.json
├── package.json                    # Root workspace config
├── CLAUDE.md                       # Development guidance
└── README.md                       # This file
```

### Build Process

Due to browser extension security constraints, critical files are **copied** from `shared-core` to each extension directory rather than using module imports. This ensures browser compatibility while maintaining the benefits of shared source code.

## Architecture

### Security Architecture
- AES-GCM encryption with password-derived keys (600,000 PBKDF2 iterations)
- Uses extension ID + deterministic salt (no master keys stored)
- API tokens encrypted before storage, decrypted only when needed
- XSS protection and minimal required permissions

### Authentication Flow
1. User configures API tokens via settings modal
2. Tokens encrypted and stored in `chrome.storage.local`
3. Background service decrypts tokens for API calls
4. JMAP session established with Fastmail
5. Real-time connection status updates

### Email Processing Flow
1. `FastmailJMAP.authenticate()` establishes JMAP session
2. `getMailboxes()` fetches mailbox hierarchy with parent/child relationships for multi-select interface
3. `buildMailboxHierarchy()` constructs folder tree and renders hierarchical display
4. `getRecentEmails()` fetches emails with multi-folder filtering using JMAP OR operations
5. `sortEmailsByPriority()` sorts emails to prioritize flagged/important ones
6. `getEmailBody()` extracts text/HTML content from emails
7. Content formatted and sent to Claude API with priority markers for enhanced summarization
8. Summary displayed with priority email highlighting and enhanced formatting

## Security & Privacy

- **Enhanced Encryption**: API keys use AES-GCM with 600,000 PBKDF2 iterations
- **Zero Permanent Storage**: Email data only sent to Claude for summarization, never stored
- **XSS Protection**: Secure HTML sanitization preserves formatting while preventing injection
- **Minimal Permissions**: Limited to storage and required API endpoints only
- **Auto-Cleanup**: Input fields cleared after encryption for security

## API Integration

### Fastmail JMAP
- Modern JMAP protocol for efficient email retrieval
- **Multi-Folder Filtering**: Supports filtering emails across multiple mailboxes simultaneously using JMAP OR operations
- **Hierarchical Mailbox Structure**: Fetches parent/child relationships with `parentId` property for proper folder tree display
- **Priority Detection**: Fetches email keywords to identify flagged/important messages
- Supports both text and HTML email content
- Comprehensive error handling and fallback mechanisms
- Respects Fastmail's API rate limits and best practices

### Claude AI
- **Model**: Claude 3.5 Haiku for fast, high-quality summaries
- **Priority Email Processing**: Automatically highlights flagged/important emails with **bold formatting**
- **Enhanced Prompts**: Instructs AI to prioritize and emphasize important messages
- **Token Limit**: 5000 tokens for detailed, comprehensive summaries
- **Processing**: Handles both text and HTML email content
- **Formatting**: Supports rich text output with lists, emphasis, and structure

## Troubleshooting

### Common Issues
1. **"Please configure your API keys first"**: Extension will automatically open the settings modal - enter your tokens there
2. **Red dot in connection status**: Check that your Fastmail API token is valid and has Mail read permissions
3. **Summarize button disabled**: Ensure you're connected to Fastmail (green dot in settings modal)
4. **Claude API errors**: Verify your Claude API key starts with `sk-ant-` and has available credits
5. **Settings modal won't close**: Make sure both API tokens are entered and Fastmail connection is successful
6. **"Unable to load folders" or "No folders available"**: Folder loading issue - try reconnecting or check Fastmail API permissions
7. **"Failed to decrypt token" errors**: Legacy tokens need re-entry due to security improvements - this is expected after updates

### UI Navigation Tips
- **Settings access**: Click the ⚙️ gear icon in the top-right corner of the popup
- **Quick configuration**: If API keys are missing, the settings modal opens automatically
- **Visual feedback**: Watch for color-coded connection status (red = disconnected, green = connected)
- **Modal controls**: Click outside the modal or the × button to close settings

### Development & Debugging
- Open Chrome DevTools (F12) to see detailed logs and errors
- Check stored data: `chrome.storage.local.get(null).then(console.log)`
- Test with fewer emails first (5 emails) to verify functionality
- Verify token permissions in Fastmail settings
- Extension logs detailed information to browser console

## Browser Compatibility

- **Chrome**: Manifest V3, Service Worker, `chrome.*` APIs (`packages/chrome-extension/`)
- **Firefox**: Manifest V2, background script, `browser.*` APIs (`packages/firefox-extension/`)
- **Shared Core**: Identical functionality across browsers via shared modules

## Development

### Technologies Used
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Background**: Chrome Extension Service Worker
- **Encryption**: Web Crypto API (AES-GCM)
- **APIs**: Fastmail JMAP, Claude AI REST API

### Code Quality
- Comprehensive error handling throughout
- Secure coding practices for API token management
- Modern JavaScript (ES2020+) with async/await
- Clean, modular architecture with separation of concerns

## Privacy & Compliance

- Email data is only sent to Claude AI for summarization
- No email content is permanently stored by the extension
- API tokens are encrypted and stored only locally in Chrome
- Comply with both Fastmail and Anthropic's terms of service
- Extension requests minimal permissions required for functionality

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions:
- Open an issue in the GitHub repository
- Check the troubleshooting section above
- Review Chrome DevTools console for detailed error information

## Acknowledgments

- [Fastmail](https://www.fastmail.com/) for their excellent JMAP API
- [Anthropic](https://www.anthropic.com/) for the Claude AI platform
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)