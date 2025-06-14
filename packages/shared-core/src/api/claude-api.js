// claude-api.js - Shared Claude AI API client
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

export class ClaudeAPI {
  constructor() {
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-haiku-latest';
  }

  async summarizeEmails(emails, apiKey) {
    // Email summarization logic will be moved here
    throw new Error('summarizeEmails method needs to be implemented');
  }

  formatEmailsForSummarization(emails) {
    // Email formatting logic will be moved here
    throw new Error('formatEmailsForSummarization method needs to be implemented');
  }

  stripHtmlTags(html) {
    // HTML stripping utility will be moved here
    throw new Error('stripHtmlTags method needs to be implemented');
  }
}