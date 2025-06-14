// secure-storage.js - Shared secure storage utilities for Chrome Extension
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
// Provides AES-GCM encryption with proper security practices

class SecureStorage {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12;
    this.saltLength = 16;
    this.keyIterations = 600000;
  }

  // Generate deterministic salt from extension ID
  getSalt() {
    const extensionId = chrome.runtime.id || 'fastmail-email-summarizer';
    const encoder = new TextEncoder();
    const data = encoder.encode(extensionId + '_v2');
    
    // Use SubtleCrypto to create deterministic salt
    return crypto.subtle.digest('SHA-256', data).then(hash => new Uint8Array(hash).slice(0, this.saltLength));
  }

  // Get the encryption key derived from user-provided password
  async getEncryptionKey(userPassword) {
    try {
      if (!userPassword || typeof userPassword !== 'string') {
        throw new Error('User password required for encryption');
      }
      
      const salt = await this.getSalt();
      
      // Import user password as key material
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(userPassword),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      // Derive encryption key using deterministic salt
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.keyIterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: this.algorithm, length: this.keyLength },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new Error('Failed to get encryption key');
    }
  }

  // Validate token input
  validateToken(token) {
    if (!token) {
      throw new Error('Token cannot be empty');
    }
    
    if (typeof token !== 'string') {
      throw new Error('Token must be a string');
    }
    
    const trimmedToken = token.trim();
    if (trimmedToken.length === 0) {
      throw new Error('Token cannot be empty or whitespace only');
    }
    
    if (trimmedToken.length > 10000) {
      throw new Error('Token is too long (max 10000 characters)');
    }
    
    return trimmedToken;
  }

  // Encrypt a token securely
  async encryptToken(token, userPassword) {
    try {
      const validatedToken = this.validateToken(token);
      const key = await this.getEncryptionKey(userPassword);
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
      const encodedToken = new TextEncoder().encode(validatedToken);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv: iv },
        key,
        encodedToken
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Return base64 encoded result for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      throw new Error('Failed to encrypt token');
    }
  }

  // Decrypt a token securely
  async decryptToken(encryptedToken, userPassword) {
    try {
      if (!encryptedToken || typeof encryptedToken !== 'string') {
        throw new Error('Invalid encrypted token');
      }
      
      const key = await this.getEncryptionKey(userPassword);
      const combined = new Uint8Array(
        atob(encryptedToken).split('').map(char => char.charCodeAt(0))
      );
      
      if (combined.length < this.ivLength) {
        throw new Error('Invalid encrypted token format');
      }
      
      const iv = combined.slice(0, this.ivLength);
      const encrypted = combined.slice(this.ivLength);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv: iv },
        key,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt token');
    }
  }


  // Clear all stored tokens (for security)
  async clearAllTokens() {
    try {
      await chrome.storage.local.clear();
      console.log('All tokens cleared');
    } catch (error) {
      console.error('Failed to clear tokens:', error);
      throw new Error('Failed to clear tokens');
    }
  }
}

// Create singleton instance
const secureStorage = new SecureStorage();

// Legacy functions - use derived password for backwards compatibility
async function encodeToken(token) {
  // Use extension ID + version as password for backwards compatibility
  const password = (chrome.runtime.id || 'fastmail-email-summarizer') + '_v2_secure';
  return await secureStorage.encryptToken(token, password);
}

async function decodeToken(encodedToken) {
  // Use extension ID + version as password for backwards compatibility
  const password = (chrome.runtime.id || 'fastmail-email-summarizer') + '_v2_secure';
  return await secureStorage.decryptToken(encodedToken, password);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SecureStorage, secureStorage, encodeToken, decodeToken };
}