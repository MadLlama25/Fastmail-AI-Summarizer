// fastmail-background-service.js - Background Script for Firefox Extension
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

// Import shared secure storage utilities
importScripts('secure-storage.js');
/* global encodeToken, decodeToken, secureStorage */

class FastmailJMAP {
  constructor() {
    this.baseUrl = 'https://api.fastmail.com/.well-known/jmap';
    this.session = null;
    this.accessToken = null;
  }

  async authenticate() {
    try {
      // COMMENTED OUT: OAuth2 authentication for testing
      // Use browser's identity API for OAuth2
      // const token = await browser.identity.getAuthToken({
      //   interactive: true,
      //   scopes: ['https://www.fastmail.com/dev/protocol']
      // });
      
      // For testing: Use direct API token from storage
      const result = await browser.storage.local.get(['fastmailApiToken']);
      if (!result.fastmailApiToken) {
        throw new Error('No Fastmail API token found. Please set your API token.');
      }
      
      // Decrypt the stored token
      this.accessToken = await decodeToken(result.fastmailApiToken);
      await this.establishSession();
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  // New method to set API token directly for testing
  async setApiToken(token) {
    try {
      // Additional validation using shared SecureStorage
      const validatedToken = secureStorage.validateToken(token);
      
      // Encrypt token before storing
      const encodedToken = await encodeToken(validatedToken);
      await browser.storage.local.set({ fastmailApiToken: encodedToken });
      this.accessToken = validatedToken;
      await this.establishSession();
      return true;
    } catch (error) {
      console.error('Failed to set API token');
      return false;
    }
  }

  async establishSession() {
    const response = await fetch(this.baseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to establish JMAP session');
    }

    this.session = await response.json();
  }

  async makeJMAPCall(methodCalls) {
    if (!this.session) {
      throw new Error('No JMAP session established');
    }

    const response = await fetch(this.session.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
        methodCalls: methodCalls
      })
    });

    if (!response.ok) {
      throw new Error(`JMAP call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async getMailboxes() {
    const methodCalls = [
      [
        'Mailbox/get',
        {
          accountId: this.session.primaryAccounts['urn:ietf:params:jmap:mail'],
          ids: null,
          properties: ['id', 'name', 'role', 'parentId', 'sortOrder']
        },
        'mailboxes'
      ]
    ];
    
    const result = await this.makeJMAPCall(methodCalls);
    const mailboxes = result.methodResponses[0][1].list;
    
    // Ensure we return an array even if empty
    return Array.isArray(mailboxes) ? mailboxes : [];
  }

  async getRecentEmails(limit = 10, mailboxIds = null) {
    // Handle single mailboxId (backward compatibility) or array of mailboxIds
    let filter = undefined;
    
    if (mailboxIds) {
      if (typeof mailboxIds === 'string' && mailboxIds.trim()) {
        // Single mailbox (backward compatibility)
        filter = { inMailbox: mailboxIds.trim() };
      } else if (Array.isArray(mailboxIds) && mailboxIds.length > 0) {
        // Multiple mailboxes - use inMailboxOtherThan with OR logic
        const validIds = mailboxIds.filter(id => id && typeof id === 'string' && id.trim());
        if (validIds.length === 1) {
          filter = { inMailbox: validIds[0] };
        } else if (validIds.length > 1) {
          filter = {
            operator: 'OR',
            conditions: validIds.map(id => ({ inMailbox: id }))
          };
        }
      }
    }
    
    const methodCalls = [
      [
        'Email/query',
        {
          accountId: this.session.primaryAccounts['urn:ietf:params:jmap:mail'],
          filter: filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: limit
        },
        'a'
      ],
      [
        'Email/get',
        {
          accountId: this.session.primaryAccounts['urn:ietf:params:jmap:mail'],
          '#ids': {
            resultOf: 'a',
            name: 'Email/query',
            path: '/ids'
          },
          properties: ['id', 'subject', 'from', 'to', 'receivedAt', 'textBody', 'htmlBody', 'bodyValues', 'keywords'],
          fetchTextBodyValues: true,
          fetchHTMLBodyValues: true
        },
        'b'
      ]
    ];

    const result = await this.makeJMAPCall(methodCalls);
    const emails = result.methodResponses[1][1].list;
    
    // Sort emails to prioritize flagged/important ones
    return this.sortEmailsByPriority(emails);
  }

  sortEmailsByPriority(emails) {
    if (!Array.isArray(emails)) return [];
    
    return emails.sort((a, b) => {
      const aIsPriority = this.isHighPriorityEmail(a);
      const bIsPriority = this.isHighPriorityEmail(b);
      
      // Priority emails come first
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      
      // For emails of same priority level, sort by received date (newest first)
      const aDate = new Date(a.receivedAt || 0);
      const bDate = new Date(b.receivedAt || 0);
      
      // Handle invalid dates gracefully
      if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0;
      if (isNaN(aDate.getTime())) return 1;
      if (isNaN(bDate.getTime())) return -1;
      
      return bDate - aDate;
    });
  }

  isHighPriorityEmail(email) {
    if (!email.keywords) return false;
    
    // Check for flagged/important keywords
    const priorityKeywords = ['$flagged', '$important', 'important', 'urgent'];
    return priorityKeywords.some(keyword => email.keywords[keyword] === true);
  }

  async getEmailBody(email) {
    try {
      
      // Check if bodyValues are already available (from initial fetch)
      if (email.bodyValues) {
        // Try to get text body first from bodyValues
        if (email.textBody && email.textBody.length > 0) {
          const bodyPart = email.textBody[0];
          if (bodyPart.partId && email.bodyValues[bodyPart.partId]) {
            return email.bodyValues[bodyPart.partId].value;
          }
        }
        
        // Fall back to HTML body from bodyValues
        if (email.htmlBody && email.htmlBody.length > 0) {
          const bodyPart = email.htmlBody[0];
          if (bodyPart.partId && email.bodyValues[bodyPart.partId]) {
            const htmlContent = email.bodyValues[bodyPart.partId].value;
            // Strip HTML tags for plain text summary
            return htmlContent.replace(/<[^>]*>/g, '').trim();
          }
        }
      }
      
      // Fallback: fetch body parts separately if not in initial response
      if (email.textBody && email.textBody.length > 0) {
        const bodyPart = email.textBody[0];
        if (bodyPart.partId) {
          return await this.getEmailBodyPart(email.id, bodyPart.partId);
        }
      }
      
      if (email.htmlBody && email.htmlBody.length > 0) {
        const bodyPart = email.htmlBody[0];
        if (bodyPart.partId) {
          const htmlContent = await this.getEmailBodyPart(email.id, bodyPart.partId);
          // Strip HTML tags for plain text summary
          return htmlContent.replace(/<[^>]*>/g, '').trim();
        }
      }
      
      return 'No body content available';
    } catch (error) {
      console.error('Error getting email body:', error);
      return 'Body content unavailable due to error';
    }
  }

  async getEmailBodyPart(emailId, partId) {
    try {
      const methodCalls = [
        [
          'Email/get',
          {
            accountId: this.session.primaryAccounts['urn:ietf:params:jmap:mail'],
            ids: [emailId],
            properties: ['bodyValues'],
            bodyProperties: [partId],
            fetchTextBodyValues: true,
            fetchHTMLBodyValues: true
          },
          'c'
        ]
      ];

      const result = await this.makeJMAPCall(methodCalls);
      
      if (result.methodResponses && result.methodResponses[0] && result.methodResponses[0][1] && result.methodResponses[0][1].list && result.methodResponses[0][1].list[0]) {
        const email = result.methodResponses[0][1].list[0];
        if (email.bodyValues && email.bodyValues[partId]) {
          return email.bodyValues[partId].value;
        } else {
          return 'Body part not accessible';
        }
      } else {
        return 'Invalid response structure';
      }
    } catch (error) {
      console.error('Error fetching email body part:', error);
      return 'Error fetching body part';
    }
  }

  async searchEmails(filter, limit = 20) {
    const methodCalls = [
      [
        'Email/query',
        {
          accountId: this.session.primaryAccounts['urn:ietf:params:jmap:mail'],
          filter: filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: limit
        },
        'a'
      ],
      [
        'Email/get',
        {
          accountId: this.session.primaryAccounts['urn:ietf:params:jmap:mail'],
          '#ids': {
            resultOf: 'a',
            name: 'Email/query',
            path: '/ids'
          },
          properties: ['id', 'subject', 'from', 'to', 'cc', 'bcc', 'receivedAt', 'textBody', 'htmlBody', 'bodyValues', 'keywords'],
          fetchTextBodyValues: true,
          fetchHTMLBodyValues: true
        },
        'b'
      ]
    ];

    const result = await this.makeJMAPCall(methodCalls);
    const emails = result.methodResponses[1][1].list;
    
    return this.sortEmailsByPriority(emails);
  }

  async getEmailsByIds(emailIds) {
    const methodCalls = [
      [
        'Email/get',
        {
          accountId: this.session.primaryAccounts['urn:ietf:params:jmap:mail'],
          ids: emailIds,
          properties: ['id', 'subject', 'from', 'to', 'cc', 'bcc', 'receivedAt', 'textBody', 'htmlBody', 'bodyValues', 'keywords'],
          fetchTextBodyValues: true,
          fetchHTMLBodyValues: true
        },
        'c'
      ]
    ];

    const result = await this.makeJMAPCall(methodCalls);
    return result.methodResponses[0][1].list;
  }
}

class ClaudeAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  async summarizeEmails(emails) {
    try {
      const emailTexts = emails.map((email, _index) => {
        const fromEmail = email.from && email.from[0] ? email.from[0].email : 'Unknown sender';
        const isPriority = email.keywords && ['$flagged', '$important', 'important', 'urgent'].some(keyword => email.keywords[keyword] === true);
        const priorityFlag = isPriority ? '[PRIORITY] ' : '';
        return `${priorityFlag}Subject: ${email.subject || 'No subject'}\nFrom: ${fromEmail}\nDate: ${email.receivedAt || 'Unknown date'}\n\n${email.bodyContent || 'No content'}\n\n---\n`;
      }).join('\n');

      const requestBody = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 5000,
        messages: [{
          role: 'user',
          content: `Please provide a concise summary of these recent emails. Pay special attention to emails marked with [PRIORITY] - these should be highlighted prominently at the beginning of your summary as they are flagged or marked as important by the user.

For priority emails, please:
- Mention them first in your summary
- Use bold formatting (**text**) to make them stand out
- Include more detail about their content and any required actions

Here are the emails:

${emailTexts}`
        }]
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Claude API error details:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        throw new Error(`Claude API error (${response.status}): ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.content || !result.content[0] || !result.content[0].text) {
        console.error('Unexpected Claude API response format:', result);
        throw new Error('Unexpected response format from Claude API');
      }
      
      return result.content[0].text;
    } catch (error) {
      console.error('Error in summarizeEmails:', error);
      throw error;
    }
  }

  // Secure HTML sanitization for summary display
  sanitizeHtml(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }
    
    // Escape HTML entities
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    let escaped = html.replace(/[&<>"'/]/g, (s) => escapeMap[s]);
    
    // Apply safe formatting for common markdown-style patterns
    escaped = escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>')              // Italic
      .replace(/\n\n/g, '</p><p>')                       // Paragraphs
      .replace(/\n/g, '<br>')                            // Line breaks
      .replace(/^(.*)$/gm, '<p>$1</p>')                  // Wrap in paragraphs
      .replace(/<p><\/p>/g, '')                          // Remove empty paragraphs
      .replace(/<p><br><\/p>/g, '<br>');                 // Fix line break paragraphs
    
    return escaped;
  }

  async chatWithEmails(userMessage, emails) {
    try {
      // Format email data for context
      const emailTexts = emails.map((email, _index) => {
        const fromEmail = email.from && email.from[0] ? email.from[0].email : 'Unknown sender';
        const isPriority = email.keywords && ['$flagged', '$important', 'important', 'urgent'].some(keyword => email.keywords[keyword] === true);
        const priorityFlag = isPriority ? '[PRIORITY] ' : '';
        return `${priorityFlag}Subject: ${email.subject || 'No subject'}\nFrom: ${fromEmail}\nDate: ${email.receivedAt || 'Unknown date'}\n\n${email.bodyContent || 'No content'}\n\n---\n`;
      }).join('\n');

      const requestBody = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `I have a question about my emails. Here are the emails for context:

${emailTexts}

Question: ${userMessage}

Please provide a helpful response based on the email content above. If the question relates to specific emails, reference them clearly.`
        }]
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Claude API chat error details:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.content || !result.content[0] || !result.content[0].text) {
        console.error('Unexpected chat response format:', result);
        throw new Error('Unexpected response format from Claude API');
      }
      
      return result.content[0].text;
    } catch (error) {
      console.error('Error in chatWithEmails:', error);
      throw error;
    }
  }

  async chatWithFastmailAPI(userMessage, fastmailInstance) {
    try {
      const requestBody = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 3000,
        tools: [
          {
            name: 'search_emails',
            description: 'Search for emails based on criteria like sender, subject, date range, keywords, or specific folders',
            input_schema: {
              type: 'object',
              properties: {
                query: {
                  type: 'object',
                  properties: {
                    from: { type: 'string', description: 'Filter by sender email address' },
                    to: { type: 'string', description: 'Filter by recipient email address' },
                    subject: { type: 'string', description: 'Filter by subject keywords' },
                    hasKeyword: { type: 'string', description: 'Filter by JMAP keyword like $flagged, $seen, etc.' },
                    text: { type: 'string', description: 'Filter by body text content' },
                    after: { type: 'string', description: 'Filter emails after this date (ISO format)' },
                    before: { type: 'string', description: 'Filter emails before this date (ISO format)' },
                    inMailbox: { type: 'string', description: 'Filter by specific mailbox ID' }
                  },
                  description: 'JMAP Email/query filter criteria'
                },
                limit: { type: 'integer', description: 'Maximum number of emails to return (default 20)', default: 20 },
                mailboxName: { type: 'string', description: 'Human-readable mailbox name to search in (e.g., "Inbox", "Sent")' }
              },
              required: []
            }
          },
          {
            name: 'get_mailboxes',
            description: 'Get list of available mailboxes/folders in the email account',
            input_schema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'get_email_details',
            description: 'Get full details of specific emails by their IDs',
            input_schema: {
              type: 'object',
              properties: {
                emailIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of email IDs to fetch details for'
                }
              },
              required: ['emailIds']
            }
          }
        ],
        messages: [{
          role: 'user',
          content: `You are an AI assistant that can help me interact with my Fastmail email account. You have access to functions that can search emails, get mailboxes, and retrieve email details.

User question: ${userMessage}

Please help me with this request. If you need to search for emails or get information from my mailbox, use the appropriate functions. You can search by sender, subject, date ranges, keywords, or specific folders. Always provide helpful and specific responses based on the actual email data.`
        }]
      };

      let response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      let result = await response.json();
      
      // Handle function calls
      while (result.content && result.content.some(content => content.type === 'tool_use')) {
        const toolUse = result.content.find(content => content.type === 'tool_use');
        let toolResult;

        try {
          switch (toolUse.name) {
            case 'search_emails':
              toolResult = await this.handleSearchEmails(toolUse.input, fastmailInstance);
              break;
            case 'get_mailboxes':
              toolResult = await this.handleGetMailboxes(fastmailInstance);
              break;
            case 'get_email_details':
              toolResult = await this.handleGetEmailDetails(toolUse.input, fastmailInstance);
              break;
            default:
              toolResult = { error: `Unknown function: ${toolUse.name}` };
          }
        } catch (error) {
          toolResult = { error: error.message };
        }

        // Continue conversation with tool result
        const messages = requestBody.messages.concat([
          { role: 'assistant', content: result.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] }
        ]);

        response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 3000,
            tools: requestBody.tools,
            messages: messages
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        result = await response.json();
      }
      
      if (!result.content || !result.content[0] || !result.content[0].text) {
        console.error('Unexpected chat response format:', result);
        throw new Error('Unexpected response format from Claude API');
      }
      
      return result.content[0].text;
    } catch (error) {
      console.error('Error in chatWithFastmailAPI:', error);
      throw error;
    }
  }

  async handleSearchEmails(input, fastmailInstance) {
    try {
      const { query = {}, limit = 20, mailboxName } = input;
      
      // Convert mailbox name to ID if provided
      let mailboxId = null;
      if (mailboxName) {
        const mailboxes = await fastmailInstance.getMailboxes();
        const matchingMailbox = mailboxes.find(mb => 
          mb.name.toLowerCase() === mailboxName.toLowerCase() || 
          mb.role === mailboxName.toLowerCase()
        );
        if (matchingMailbox) {
          mailboxId = matchingMailbox.id;
        }
      }

      // Build JMAP filter
      let filter = {};
      if (query.from) filter.from = query.from;
      if (query.to) filter.to = query.to;
      if (query.subject) filter.subject = query.subject;
      if (query.hasKeyword) filter.hasKeyword = query.hasKeyword;
      if (query.text) filter.text = query.text;
      if (query.after) filter.after = query.after;
      if (query.before) filter.before = query.before;
      if (query.inMailbox || mailboxId) filter.inMailbox = query.inMailbox || mailboxId;

      // Use empty filter if no criteria provided
      if (Object.keys(filter).length === 0) {
        filter = undefined;
      }

      const emails = await fastmailInstance.searchEmails(filter, limit);
      
      // Get email bodies for the results
      for (let email of emails) {
        try {
          email.bodyContent = await fastmailInstance.getEmailBody(email);
        } catch (error) {
          email.bodyContent = 'Body content unavailable';
        }
      }

      return {
        success: true,
        count: emails.length,
        emails: emails.map(email => ({
          id: email.id,
          subject: email.subject,
          from: email.from && email.from[0] ? email.from[0].email : 'Unknown',
          to: email.to && email.to[0] ? email.to[0].email : 'Unknown',
          receivedAt: email.receivedAt,
          bodyContent: email.bodyContent ? email.bodyContent.substring(0, 500) + '...' : 'No content',
          keywords: Object.keys(email.keywords || {}),
          isPriority: email.keywords && ['$flagged', '$important', 'important', 'urgent'].some(keyword => email.keywords[keyword] === true)
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleGetMailboxes(fastmailInstance) {
    try {
      const mailboxes = await fastmailInstance.getMailboxes();
      return {
        success: true,
        mailboxes: mailboxes.map(mb => ({
          id: mb.id,
          name: mb.name,
          role: mb.role,
          parentId: mb.parentId,
          totalEmails: mb.totalEmails,
          unreadEmails: mb.unreadEmails
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleGetEmailDetails(input, fastmailInstance) {
    try {
      const { emailIds } = input;
      const emails = await fastmailInstance.getEmailsByIds(emailIds);
      
      // Get email bodies
      for (let email of emails) {
        try {
          email.bodyContent = await fastmailInstance.getEmailBody(email);
        } catch (error) {
          email.bodyContent = 'Body content unavailable';
        }
      }

      return {
        success: true,
        emails: emails.map(email => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
          receivedAt: email.receivedAt,
          bodyContent: email.bodyContent,
          keywords: email.keywords,
          isPriority: email.keywords && ['$flagged', '$important', 'important', 'urgent'].some(keyword => email.keywords[keyword] === true)
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Firefox extension message handlers - using browser.runtime instead of chrome.runtime
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'authenticate': {
          const jmap = new FastmailJMAP();
          const success = await jmap.authenticate();
          sendResponse({ success });
          break;
        }

        case 'setApiToken': {
          // Receive already encrypted token from UI
          const { encryptedApiToken } = request;
          if (!encryptedApiToken) {
            throw new Error('No encrypted API token provided');
          }
          
          // Store the encrypted token directly and decrypt for use
          await browser.storage.local.set({ fastmailApiToken: encryptedApiToken });
          const apiToken = await decodeToken(encryptedApiToken);
          const fastmailJmap = new FastmailJMAP();
          fastmailJmap.accessToken = apiToken;
          await fastmailJmap.establishSession();
          await browser.storage.local.set({ isAuthenticated: true });
          sendResponse({ success: true });
          break;
        }

        case 'getMailboxes': {
          const mailboxFastmail = new FastmailJMAP();
          const mailboxAuthSuccess = await mailboxFastmail.authenticate();
          if (!mailboxAuthSuccess) {
            throw new Error('Not authenticated with Fastmail - please set your API token first');
          }
          const mailboxes = await mailboxFastmail.getMailboxes();
          sendResponse({ success: true, mailboxes });
          break;
        }

        case 'summarizeEmails': {
          const { encryptedClaudeApiKey, emailCount, mailboxIds } = request;
          if (!encryptedClaudeApiKey) {
            throw new Error('No encrypted Claude API key provided');
          }
          
          // Decrypt the Claude API key in the background service
          const claudeApiKey = await decodeToken(encryptedClaudeApiKey);
          
          if (!claudeApiKey || !claudeApiKey.startsWith('sk-ant-')) {
            throw new Error('Invalid Claude API key format. Expected key starting with sk-ant-');
          }
          
          const fastmail = new FastmailJMAP();
          const claude = new ClaudeAPI(claudeApiKey);

          // Authenticate using the proper method
          const authSuccess = await fastmail.authenticate();
          if (!authSuccess) {
            throw new Error('Not authenticated with Fastmail - please set your API token first');
          }

          // Get recent emails with optional folder filtering
          const emails = await fastmail.getRecentEmails(emailCount || 10, mailboxIds);
          
          // Get email bodies with error handling to prevent memory leaks
          for (let email of emails) {
            try {
              email.bodyContent = await fastmail.getEmailBody(email);
            } catch (error) {
              console.error(`Failed to get body for email ${email.id}:`, error);
              email.bodyContent = 'Body content unavailable';
            }
          }

          // Summarize with Claude
          const summary = await claude.summarizeEmails(emails);
          
          // Store email data for chat functionality
          await browser.storage.local.set({ 
            latestEmailData: emails,
            latestSummary: {
              summary: summary,
              timestamp: Date.now(),
              emailCount: emails.length
            }
          });
          
          sendResponse({ success: true, summary, emailData: emails });
          break;
        }

        case 'chatWithAI': {
          const { message, emailData, useEnhancedMode } = request;
          
          // Get the Claude API key from storage
          const result = await browser.storage.local.get(['claudeApiKey']);
          if (!result.claudeApiKey) {
            sendResponse({ success: false, error: 'Claude API key not found' });
            break;
          }
          
          const decryptedClaudeKey = await decodeToken(result.claudeApiKey);
          const claude = new ClaudeAPI();
          claude.apiKey = decryptedClaudeKey;
          
          let response;
          
          // Use enhanced mode with Fastmail API access if requested or if no email data available
          if (useEnhancedMode || !emailData || emailData.length === 0) {
            // Create a new Fastmail instance for API access
            const fastmail = new FastmailJMAP();
            const authSuccess = await fastmail.authenticate();
            if (!authSuccess) {
              sendResponse({ success: false, error: 'Not authenticated with Fastmail - please ensure you are connected' });
              break;
            }
            
            response = await claude.chatWithFastmailAPI(message, fastmail);
          } else {
            // Use basic mode with provided email data
            response = await claude.chatWithEmails(message, emailData);
          }
          
          sendResponse({ success: true, response });
          break;
        }

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});