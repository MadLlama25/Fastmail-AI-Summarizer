// index.js - Shared core exports
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

// Storage
export { SecureStorage } from './storage/secure-storage.js';

// API clients
export { FastmailJMAP } from './api/fastmail-jmap.js';
export { ClaudeAPI } from './api/claude-api.js';

// Utilities
export { formatSummaryTextSecurely, escapeHtml } from './utils/html-sanitizer.js';