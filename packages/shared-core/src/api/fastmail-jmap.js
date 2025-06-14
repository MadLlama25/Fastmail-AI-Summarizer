// fastmail-jmap.js - Shared JMAP API client for Fastmail
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

export class FastmailJMAP {
  constructor() {
    this.baseUrl = 'https://api.fastmail.com/.well-known/jmap';
    this.session = null;
    this.accessToken = null;
  }

  async authenticate() {
    // Authentication logic will be moved here from background services
    throw new Error('authenticate method needs to be implemented');
  }

  async getMailboxes() {
    // Mailbox retrieval logic will be moved here
    throw new Error('getMailboxes method needs to be implemented');
  }

  async getRecentEmails(mailboxIds, emailCount) {
    // Email retrieval logic will be moved here
    throw new Error('getRecentEmails method needs to be implemented');
  }

  sortEmailsByPriority(emails) {
    // Priority sorting logic will be moved here
    throw new Error('sortEmailsByPriority method needs to be implemented');
  }

  isHighPriorityEmail(email) {
    const priorityKeywords = ['$flagged', '$important', 'important', 'urgent'];
    return priorityKeywords.some(keyword => email.keywords && email.keywords[keyword] === true);
  }
}