// popup.js - Frontend logic for the Chrome extension popup
/* global encodeToken */
// Copyright (C) 2025 Jeremy Gill
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// Note: secure-storage.js is loaded before this file in popup-html.html

class EmailSummarizerUI {
  constructor() {
    this.initializeElements();
    this.loadSavedConfig();
    this.attachEventListeners();
  }

  initializeElements() {
    this.fastmailApiTokenInput = document.getElementById('fastmailApiToken');
    this.claudeApiKeyInput = document.getElementById('claudeApiKey');
    this.emailCountSelect = document.getElementById('emailCount');
    this.folderSelector = document.getElementById('folderSelector');
    this.folderSummary = document.getElementById('folderSummary');
    this.allFoldersCheckbox = document.getElementById('allFolders');
    this.authenticateBtn = document.getElementById('authenticateBtn');
    this.summarizeBtn = document.getElementById('summarizeBtn');
    this.statusDiv = document.getElementById('status');
    this.summaryContainer = document.getElementById('summaryContainer');
    this.summaryContent = document.getElementById('summaryContent');
    
    // New menu elements
    this.settingsBtn = document.getElementById('settingsBtn');
    this.configMenu = document.getElementById('configMenu');
    this.closeConfigBtn = document.getElementById('closeConfigBtn');
    this.connectionStatus = document.getElementById('connectionStatus');
    
    // Chat elements
    this.chatSection = document.getElementById('chatSection');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendChatBtn = document.getElementById('sendChatBtn');
    this.enhancedModeToggle = document.getElementById('enhancedModeToggle');
    
    // Mailbox storage
    this.mailboxes = [];
    this.currentEmailData = null;
  }

  async loadSavedConfig() {
    try {
      const result = await chrome.storage.local.get(['fastmailApiToken', 'claudeApiKey', 'emailCount', 'isAuthenticated']);
      
      if (result.fastmailApiToken) {
        // Don't display encrypted tokens in form fields for security
        // Instead, show a placeholder to indicate a token is stored
        this.fastmailApiTokenInput.placeholder = "API token stored securely";
      }
      
      if (result.claudeApiKey) {
        // Don't display encrypted tokens in form fields for security
        // Instead, show a placeholder to indicate a key is stored
        this.claudeApiKeyInput.placeholder = "API key stored securely";
      }
      
      if (result.emailCount) {
        this.emailCountSelect.value = result.emailCount;
      }
      
      if (result.isAuthenticated) {
        this.updateAuthenticationStatus(true);
        this.updateConnectionStatus(true);
        this.summarizeBtn.disabled = false;
        await this.loadMailboxes();
      } else {
        this.updateConnectionStatus(false);
        this.summarizeBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error loading saved config:', error);
    }
  }

  async saveConfig() {
    try {
      const config = {
        emailCount: this.emailCountSelect.value
      };
      
      // Encrypt tokens before storing (only if they have values)
      if (this.fastmailApiTokenInput.value.trim()) {
        config.fastmailApiToken = await encodeToken(this.fastmailApiTokenInput.value.trim());
        // Clear the input field after encryption for security
        this.fastmailApiTokenInput.value = '';
        this.fastmailApiTokenInput.placeholder = "API token stored securely";
      }
      
      if (this.claudeApiKeyInput.value.trim()) {
        config.claudeApiKey = await encodeToken(this.claudeApiKeyInput.value.trim());
        // Clear the input field after encryption for security
        this.claudeApiKeyInput.value = '';
        this.claudeApiKeyInput.placeholder = "API key stored securely";
      }
      
      await chrome.storage.local.set(config);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  attachEventListeners() {
    this.authenticateBtn.addEventListener('click', () => this.handleAuthenticate());
    this.summarizeBtn.addEventListener('click', () => this.handleSummarize());
    
    // Menu toggle functionality
    this.settingsBtn.addEventListener('click', () => this.openConfigMenu());
    this.closeConfigBtn.addEventListener('click', () => this.closeConfigMenu());
    
    // Close menu when clicking outside
    this.configMenu.addEventListener('click', (e) => {
      if (e.target === this.configMenu) {
        this.closeConfigMenu();
      }
    });
    
    // Save config when inputs change - await to prevent race conditions
    this.fastmailApiTokenInput.addEventListener('input', async () => await this.saveConfig());
    this.claudeApiKeyInput.addEventListener('input', async () => await this.saveConfig());
    this.emailCountSelect.addEventListener('change', async () => await this.saveConfig());
    
    // Handle folder selection changes
    this.allFoldersCheckbox.addEventListener('change', () => this.handleAllFoldersChange());
    
    // Chat functionality event listeners
    this.sendChatBtn.addEventListener('click', () => this.sendChatMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
  }

  showStatus(message, type = 'info') {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.classList.remove('hidden');
    
    // Auto-hide after 5 seconds for non-error messages
    if (type !== 'error') {
      setTimeout(() => {
        this.statusDiv.classList.add('hidden');
      }, 5000);
    }
  }

  openConfigMenu() {
    this.configMenu.classList.remove('hidden');
  }
  
  closeConfigMenu() {
    this.configMenu.classList.add('hidden');
  }
  
  updateConnectionStatus(isConnected) {
    const indicator = this.connectionStatus.querySelector('.status-indicator');
    const text = this.connectionStatus.querySelector('.status-text');
    
    if (isConnected) {
      indicator.classList.add('connected');
      text.textContent = 'Connected to Fastmail';
    } else {
      indicator.classList.remove('connected');
      text.textContent = 'Not connected';
    }
  }

  updateAuthenticationStatus(isAuthenticated) {
    if (isAuthenticated) {
      this.authenticateBtn.textContent = '✅ Connected to Fastmail';
      this.authenticateBtn.disabled = true;
      this.summarizeBtn.disabled = false;
    } else {
      this.authenticateBtn.textContent = '🔐 Connect to Fastmail';
      this.authenticateBtn.disabled = false;
      this.summarizeBtn.disabled = true;
    }
  }

  async handleAuthenticate() {
    try {
      this.authenticateBtn.disabled = true;
      this.authenticateBtn.textContent = '🔄 Connecting...';
      this.showStatus('Connecting to Fastmail with API token...', 'info');

      // Check for API token in input field or storage
      let encryptedToken = null;
      
      if (this.fastmailApiTokenInput.value.trim()) {
        // Token is in input field - save config first (this will encrypt and store it)
        await this.saveConfig();
        // Get the encrypted token from storage
        const result = await chrome.storage.local.get(['fastmailApiToken']);
        encryptedToken = result.fastmailApiToken;
      } else {
        // Check if token exists in storage
        const result = await chrome.storage.local.get(['fastmailApiToken']);
        if (result.fastmailApiToken) {
          encryptedToken = result.fastmailApiToken;
        }
      }

      // Validate that we have a token (either from input or storage)
      if (!encryptedToken) {
        this.showStatus('Please enter your Fastmail API token', 'error');
        this.updateAuthenticationStatus(false);
        return;
      }
      
      // Use direct API token instead of OAuth2 - send encrypted token
      const response = await this.sendMessageToBackground('setApiToken', {
        encryptedApiToken: encryptedToken
      });
      
      if (response.success) {
        this.updateAuthenticationStatus(true);
        this.updateConnectionStatus(true);
        this.showStatus('Successfully connected to Fastmail with API token!', 'success');
        await this.loadMailboxes();
        this.closeConfigMenu();
      } else {
        throw new Error('Authentication failed - please check your API token');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.showStatus(`Authentication failed: ${error.message}`, 'error');
      this.updateAuthenticationStatus(false);
      this.updateConnectionStatus(false);
    }
  }

  async handleSummarize() {
    try {
      this.summarizeBtn.disabled = true;
      this.summarizeBtn.textContent = '🔄 Summarizing...';
      this.showStatus('Fetching and summarizing emails...', 'info');
      this.summaryContainer.classList.add('hidden');

      // Get Claude API key from input field or storage
      let encryptedClaudeApiKey = null;
      
      if (this.claudeApiKeyInput.value.trim()) {
        // Key is in input field - save config first (this will encrypt and store it)
        await this.saveConfig();
        // Get the encrypted key from storage
        const result = await chrome.storage.local.get(['claudeApiKey']);
        encryptedClaudeApiKey = result.claudeApiKey;
      } else {
        // Try to get encrypted key from storage
        const result = await chrome.storage.local.get(['claudeApiKey']);
        if (result.claudeApiKey) {
          encryptedClaudeApiKey = result.claudeApiKey;
        }
      }

      if (!encryptedClaudeApiKey) {
        this.showStatus('Please configure your API keys first', 'error');
        this.openConfigMenu();
        this.summarizeBtn.disabled = false;
        this.summarizeBtn.textContent = '📝 Summarize Recent Emails';
        return;
      }

      const selectedMailboxIds = this.getSelectedMailboxIds();
      
      const response = await this.sendMessageToBackground('summarizeEmails', {
        encryptedClaudeApiKey: encryptedClaudeApiKey,
        emailCount: parseInt(this.emailCountSelect.value),
        mailboxIds: selectedMailboxIds.length > 0 ? selectedMailboxIds : null
      });

      if (response.success) {
        // Store email data for chat functionality
        this.currentEmailData = response.emailData;
        
        // Display summary in enhanced popup format
        this.displayEnhancedSummary(response.summary);
        this.showStatus('Emails summarized successfully!', 'success');
      } else {
        throw new Error(response.error || 'Summarization failed');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.summarizeBtn.disabled = false;
      this.summarizeBtn.textContent = '📝 Summarize Recent Emails';
    }
  }

  displayEnhancedSummary(summary) {
    // Format and safely display the summary text
    const formattedSummary = this.formatSummaryTextSecurely(summary);
    this.summaryContent.innerHTML = formattedSummary;
    
    // Add timestamp and email count
    const timestamp = new Date().toLocaleString();
    const emailCount = this.emailCountSelect.value;
    
    // Create or update meta info
    let metaInfo = this.summaryContainer.querySelector('.summary-meta');
    if (!metaInfo) {
      metaInfo = document.createElement('div');
      metaInfo.className = 'summary-meta';
      this.summaryContainer.insertBefore(metaInfo, this.summaryContent);
    }
    
    metaInfo.innerHTML = `
      <div class="meta-row">
        <span class="meta-label">📊 Generated:</span>
        <span class="meta-value">${timestamp}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">📧 Emails analyzed:</span>
        <span class="meta-value">${emailCount} emails</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">🤖 AI Model:</span>
        <span class="meta-value">Claude 3.5 Haiku</span>
      </div>
    `;
    
    // Show the summary container and chat section
    this.summaryContainer.classList.remove('hidden');
    this.chatSection.classList.remove('hidden');
    
    // Clear any existing chat messages and add welcome message
    this.chatMessages.innerHTML = '';
    this.addChatMessage(`👋 Hi! I've analyzed ${emailCount} of your emails. Feel free to ask me questions about them! Toggle "Enhanced Mode" to search your entire mailbox.`, 'assistant');
    
    // Add action buttons if they don't exist
    this.addActionButtons();
  }

  formatSummaryText(text) {
    if (!text) return '<p>No summary available.</p>';
    
    // Basic formatting for better readability
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
      .replace(/(-\s)/g, '<br>• ');
  }

  // Securely format summary text with safe HTML
  formatSummaryTextSecurely(text) {
    if (!text) return '<p>No summary available.</p>';
    
    // First escape any HTML to prevent XSS
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Then apply safe formatting transformations
    return escapedText
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
      .replace(/(-\s)/g, '<br>• ');
  }

  addActionButtons() {
    // Check if action buttons already exist
    if (this.summaryContainer.querySelector('.summary-actions')) {
      return;
    }
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'summary-actions';
    
    // Create buttons with proper event listeners
    const textSizeBtn = document.createElement('button');
    textSizeBtn.className = 'btn btn-small';
    textSizeBtn.innerHTML = '🔍 Text Size';
    textSizeBtn.addEventListener('click', () => this.toggleTextSize());
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-small';
    copyBtn.innerHTML = '📋 Copy';
    copyBtn.addEventListener('click', () => this.copyToClipboard(copyBtn));
    
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-small';
    printBtn.innerHTML = '🖨️ Print';
    printBtn.addEventListener('click', () => this.printSummary());
    
    actionsDiv.appendChild(textSizeBtn);
    actionsDiv.appendChild(copyBtn);
    actionsDiv.appendChild(printBtn);
    
    this.summaryContainer.appendChild(actionsDiv);
  }

  toggleTextSize() {
    const currentSize = window.getComputedStyle(this.summaryContent).fontSize;
    const newSize = currentSize === '14px' ? '16px' : '14px';
    this.summaryContent.style.fontSize = newSize;
  }

  async copyToClipboard(button) {
    try {
      const textContent = this.summaryContent.textContent;
      await navigator.clipboard.writeText(textContent);
      button.innerHTML = '✅ Copied!';
      setTimeout(() => {
        button.innerHTML = '📋 Copy';
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      button.innerHTML = '❌ Failed';
      setTimeout(() => {
        button.innerHTML = '📋 Copy';
      }, 2000);
    }
  }

  async loadMailboxes() {
    try {
      const response = await this.sendMessageToBackground('getMailboxes');
      if (response.success && response.mailboxes) {
        this.populateMailboxOptions(response.mailboxes);
      } else {
        // Handle empty or failed mailbox loading
        console.error('Failed to load mailboxes or no mailboxes available');
        this.showMailboxLoadingError();
      }
    } catch (error) {
      console.error('Error loading mailboxes:', error);
      this.showMailboxLoadingError();
    }
  }

  showMailboxLoadingError() {
    // Clear folder items except "All Folders"
    const allFoldersItem = this.folderSelector.querySelector('.folder-item');
    this.folderSelector.innerHTML = '';
    this.folderSelector.appendChild(allFoldersItem);
    
    // Add error indicator
    const errorItem = document.createElement('div');
    errorItem.className = 'folder-item';
    errorItem.innerHTML = '<span style="color: #666; font-style: italic;">Unable to load folders</span>';
    this.folderSelector.appendChild(errorItem);
  }

  populateMailboxOptions(mailboxes) {
    // Store mailboxes for later use
    this.mailboxes = mailboxes;
    
    // Clear existing folder items except "All Folders"
    const allFoldersItem = this.folderSelector.querySelector('.folder-item');
    this.folderSelector.innerHTML = '';
    this.folderSelector.appendChild(allFoldersItem);

    // Validate mailboxes input
    if (!Array.isArray(mailboxes) || mailboxes.length === 0) {
      const noFoldersItem = document.createElement('div');
      noFoldersItem.className = 'folder-item';
      noFoldersItem.innerHTML = '<span style="color: #666; font-style: italic;">No folders available</span>';
      this.folderSelector.appendChild(noFoldersItem);
      return;
    }

    // Build hierarchical structure
    const hierarchy = this.buildMailboxHierarchy(mailboxes);
    
    // Render the hierarchy
    this.renderMailboxHierarchy(hierarchy);
  }

  printSummary() {
    // Create a new window with just the summary content for printing
    const printWindow = window.open('', '_blank');
    const summaryHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Summary</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
          .summary-meta { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
          .meta-row { margin-bottom: 8px; }
          .meta-label { font-weight: 600; }
          .summary-content { line-height: 1.6; }
          h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>📧 Email Summary</h1>
        ${this.summaryContainer.querySelector('.summary-meta').outerHTML}
        <div class="summary-content">${this.summaryContent.innerHTML}</div>
      </body>
      </html>
    `;
    
    printWindow.document.write(summaryHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  buildMailboxHierarchy(mailboxes) {
    // Filter valid mailboxes
    const validMailboxes = mailboxes.filter(mailbox => mailbox && mailbox.id && mailbox.name);
    
    // Create a map for quick lookup
    const mailboxMap = {};
    validMailboxes.forEach(mailbox => {
      mailboxMap[mailbox.id] = { ...mailbox, children: [] };
    });
    
    // Build hierarchy
    const rootMailboxes = [];
    validMailboxes.forEach(mailbox => {
      if (mailbox.parentId && mailboxMap[mailbox.parentId]) {
        mailboxMap[mailbox.parentId].children.push(mailboxMap[mailbox.id]);
      } else {
        rootMailboxes.push(mailboxMap[mailbox.id]);
      }
    });
    
    // Sort function for prioritizing common folders
    const sortMailboxes = (mailboxes) => {
      return mailboxes.sort((a, b) => {
        const aRole = a.role || '';
        const bRole = b.role || '';
        
        // Prioritize common folders
        const roleOrder = { 'inbox': 0, 'sent': 1, 'drafts': 2, 'trash': 3, 'junk': 4 };
        const aPriority = roleOrder[aRole.toLowerCase()] ?? 999;
        const bPriority = roleOrder[bRole.toLowerCase()] ?? 999;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        return a.name.localeCompare(b.name);
      });
    };
    
    // Sort root mailboxes and their children
    const sortedRootMailboxes = sortMailboxes(rootMailboxes);
    sortedRootMailboxes.forEach(mailbox => {
      if (mailbox.children.length > 0) {
        mailbox.children = sortMailboxes(mailbox.children);
      }
    });
    
    return sortedRootMailboxes;
  }
  
  renderMailboxHierarchy(hierarchy) {
    hierarchy.forEach(mailbox => {
      this.createMailboxCheckbox(mailbox, false);
      
      // Render children with indentation
      if (mailbox.children && mailbox.children.length > 0) {
        mailbox.children.forEach(child => {
          this.createMailboxCheckbox(child, true);
        });
      }
    });
  }
  
  createMailboxCheckbox(mailbox, isChild = false) {
    const folderItem = document.createElement('div');
    folderItem.className = `folder-item ${isChild ? 'child' : ''}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `mailbox-${mailbox.id}`;
    checkbox.value = mailbox.id;
    checkbox.addEventListener('change', () => this.handleFolderSelectionChange());
    
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    
    // Build hierarchical name
    if (isChild && mailbox.parentId) {
      const parent = this.mailboxes.find(m => m.id === mailbox.parentId);
      if (parent) {
        label.textContent = `${parent.name} / ${mailbox.name}`;
      } else {
        label.textContent = mailbox.name;
      }
    } else {
      label.textContent = mailbox.name;
    }
    
    folderItem.appendChild(checkbox);
    folderItem.appendChild(label);
    this.folderSelector.appendChild(folderItem);
  }
  
  handleAllFoldersChange() {
    const isChecked = this.allFoldersCheckbox.checked;
    
    // Uncheck all individual folder checkboxes when "All Folders" is selected
    if (isChecked) {
      const folderCheckboxes = this.folderSelector.querySelectorAll('input[type="checkbox"]:not(#allFolders)');
      folderCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
    }
    
    this.updateFolderSummary();
  }
  
  handleFolderSelectionChange() {
    // If any specific folder is selected, uncheck "All Folders"
    const folderCheckboxes = this.folderSelector.querySelectorAll('input[type="checkbox"]:not(#allFolders)');
    const hasSelectedFolders = Array.from(folderCheckboxes).some(checkbox => checkbox.checked);
    
    if (hasSelectedFolders) {
      this.allFoldersCheckbox.checked = false;
    } else {
      // If no specific folders are selected, default to "All Folders"
      this.allFoldersCheckbox.checked = true;
    }
    
    this.updateFolderSummary();
  }
  
  getSelectedMailboxIds() {
    if (this.allFoldersCheckbox.checked) {
      return []; // Empty array means all folders
    }
    
    const folderCheckboxes = this.folderSelector.querySelectorAll('input[type="checkbox"]:not(#allFolders):checked');
    return Array.from(folderCheckboxes).map(checkbox => checkbox.value);
  }
  
  updateFolderSummary() {
    const selectedIds = this.getSelectedMailboxIds();
    
    if (selectedIds.length === 0) {
      this.folderSummary.textContent = 'All Folders';
    } else if (selectedIds.length === 1) {
      const mailbox = this.mailboxes.find(m => m.id === selectedIds[0]);
      this.folderSummary.textContent = mailbox ? mailbox.name : '1 folder selected';
    } else {
      this.folderSummary.textContent = `${selectedIds.length} folders selected`;
    }
  }

  async sendChatMessage() {
    const message = this.chatInput.value.trim();
    
    if (!message) return;
    
    const isEnhancedMode = this.enhancedModeToggle.checked;
    
    // Check if we have email data for basic mode
    if (!isEnhancedMode && (!this.currentEmailData || this.currentEmailData.length === 0)) {
      this.addChatMessage('❌ No email data available. Please generate a summary first or enable Enhanced Mode to search your mailbox.', 'assistant');
      return;
    }
    
    // Clear input and disable
    this.chatInput.value = '';
    this.chatInput.disabled = true;
    this.sendChatBtn.disabled = true;
    
    // Add user message to chat
    this.addChatMessage(message, 'user');
    
    // Show loading indicator with mode indication
    const modeText = isEnhancedMode ? 'Searching your mailbox' : 'Analyzing summary data';
    const loadingElement = this.addChatMessage(`🤖 ${modeText}<span class="chat-loading-dots"></span>`, 'assistant', true);
    
    try {
      // Send message to background script with enhanced mode flag
      const response = await this.sendMessageToBackground('chatWithAI', {
        message: message,
        emailData: this.currentEmailData,
        useEnhancedMode: isEnhancedMode
      });
      
      // Remove loading indicator
      loadingElement.remove();
      
      if (response.success) {
        this.addChatMessage(response.response, 'assistant');
      } else {
        this.addChatMessage('❌ Sorry, I encountered an error: ' + response.error, 'assistant');
      }
    } catch (error) {
      loadingElement.remove();
      this.addChatMessage('❌ Failed to get response: ' + error.message, 'assistant');
    } finally {
      // Re-enable input
      this.chatInput.disabled = false;
      this.sendChatBtn.disabled = false;
      this.chatInput.focus();
    }
  }

  addChatMessage(message, sender, isLoading = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    
    if (isLoading) {
      messageDiv.innerHTML = `<div class="chat-loading">${message}</div>`;
    } else {
      const timestamp = new Date().toLocaleTimeString();
      messageDiv.innerHTML = `
        <div>${this.escapeHtml(message)}</div>
        <div class="timestamp">${timestamp}</div>
      `;
    }
    
    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    
    return messageDiv;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async sendMessageToBackground(action, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action, ...data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }
}

// Initialize the UI when the popup loads
document.addEventListener('DOMContentLoaded', () => {
  new EmailSummarizerUI();
});