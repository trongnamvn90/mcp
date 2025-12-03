/**
 * Storage utility for persisting API docs and credentials
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { StorageData, ApiDoc, Credential } from '../types/index.js';

const DEFAULT_STORAGE_DIR = join(homedir(), '.mcp-api-testing');
const STORAGE_FILE = 'data.json';

export class Storage {
  private storagePath: string;
  private data: StorageData;

  constructor(storageDir?: string) {
    const dir = storageDir || DEFAULT_STORAGE_DIR;
    this.storagePath = join(dir, STORAGE_FILE);
    this.data = { apiDocs: [], credentials: [] };
  }

  async init(): Promise<void> {
    const dir = join(this.storagePath, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (existsSync(this.storagePath)) {
      try {
        const content = await readFile(this.storagePath, 'utf-8');
        this.data = JSON.parse(content);
      } catch (error) {
        // Log full error with stack trace for debugging
        console.error(`[Storage] Failed to load data from ${this.storagePath}:`);
        if (error instanceof Error) {
          console.error(`[Storage] Error: ${error.message}`);
          if (error.stack) {
            console.error(`[Storage] Stack trace:\n${error.stack}`);
          }
        } else {
          console.error('[Storage] Error:', error);
        }
        console.error('[Storage] Starting with empty data');
        this.data = { apiDocs: [], credentials: [] };
      }
    }
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  private async save(): Promise<void> {
    await writeFile(this.storagePath, JSON.stringify(this.data, null, 2));
  }

  // API Docs methods
  async getApiDocs(): Promise<ApiDoc[]> {
    return this.data.apiDocs;
  }

  async getApiDoc(id: string): Promise<ApiDoc | undefined> {
    return this.data.apiDocs.find((doc) => doc.id === id);
  }

  async getApiDocByBaseUrl(baseUrl: string): Promise<ApiDoc | undefined> {
    const normalizedUrl = this.normalizeUrl(baseUrl);
    return this.data.apiDocs.find(
      (doc) => this.normalizeUrl(doc.baseUrl) === normalizedUrl
    );
  }

  async addApiDoc(apiDoc: ApiDoc): Promise<ApiDoc> {
    const existing = await this.getApiDoc(apiDoc.id);
    if (existing) {
      throw new Error(`API doc with id '${apiDoc.id}' already exists`);
    }
    this.data.apiDocs.push(apiDoc);
    await this.save();
    return apiDoc;
  }

  async updateApiDoc(id: string, updates: Partial<ApiDoc>): Promise<ApiDoc> {
    const index = this.data.apiDocs.findIndex((doc) => doc.id === id);
    if (index === -1) {
      throw new Error(`API doc with id '${id}' not found`);
    }
    // Prevent id mutation - remove id from updates to preserve primary key
    const { id: _ignoredId, ...safeUpdates } = updates;
    this.data.apiDocs[index] = {
      ...this.data.apiDocs[index],
      ...safeUpdates,
      id, // Ensure id is preserved
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    return this.data.apiDocs[index];
  }

  async removeApiDoc(id: string): Promise<boolean> {
    const index = this.data.apiDocs.findIndex((doc) => doc.id === id);
    if (index === -1) {
      return false;
    }
    this.data.apiDocs.splice(index, 1);
    await this.save();
    return true;
  }

  // Credentials methods
  async getCredentials(): Promise<Credential[]> {
    // Return credentials without sensitive data
    return this.data.credentials.map((cred) => ({
      ...cred,
      config: this.maskCredentialConfig(cred.config),
    }));
  }

  async getCredential(id: string): Promise<Credential | undefined> {
    return this.data.credentials.find((cred) => cred.id === id);
  }

  async addCredential(credential: Credential): Promise<Credential> {
    const existing = await this.getCredential(credential.id);
    if (existing) {
      throw new Error(`Credential with id '${credential.id}' already exists`);
    }
    this.data.credentials.push(credential);
    await this.save();
    return {
      ...credential,
      config: this.maskCredentialConfig(credential.config),
    };
  }

  async updateCredential(
    id: string,
    updates: Partial<Credential>
  ): Promise<Credential> {
    const index = this.data.credentials.findIndex((cred) => cred.id === id);
    if (index === -1) {
      throw new Error(`Credential with id '${id}' not found`);
    }
    // Prevent id mutation - remove id from updates to preserve primary key
    const { id: _ignoredId, ...safeUpdates } = updates;
    this.data.credentials[index] = {
      ...this.data.credentials[index],
      ...safeUpdates,
      id, // Ensure id is preserved
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    return {
      ...this.data.credentials[index],
      config: this.maskCredentialConfig(this.data.credentials[index].config),
    };
  }

  async removeCredential(id: string): Promise<boolean> {
    const index = this.data.credentials.findIndex((cred) => cred.id === id);
    if (index === -1) {
      return false;
    }
    this.data.credentials.splice(index, 1);
    await this.save();
    return true;
  }

  // Whitelist validation
  isUrlWhitelisted(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return this.data.apiDocs.some((doc) => {
      const docBaseUrl = this.normalizeUrl(doc.baseUrl);
      return normalizedUrl.startsWith(docBaseUrl);
    });
  }

  getWhitelistedBaseUrls(): string[] {
    return this.data.apiDocs.map((doc) => doc.baseUrl);
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(
        /\/+$/,
        ''
      );
    } catch {
      return url.replace(/\/+$/, '');
    }
  }

  private maskCredentialConfig(
    config: Credential['config']
  ): Credential['config'] {
    const masked = { ...config };
    const sensitiveFields = [
      'apiKey',
      'token',
      'password',
      'clientSecret',
      'accessToken',
      'refreshToken',
    ] as const;

    for (const field of sensitiveFields) {
      if (field in masked && masked[field]) {
        const value = masked[field] as string;
        masked[field] = this.maskString(value);
      }
    }

    // Mask legacy custom headers
    if (masked.headers) {
      masked.headers = Object.fromEntries(
        Object.entries(masked.headers).map(([key, value]) => [
          key,
          this.isSensitiveHeader(key) ? this.maskString(value) : value,
        ])
      );
    }

    // Mask customHeaders array
    if (masked.customHeaders) {
      masked.customHeaders = masked.customHeaders.map((header) => ({
        name: header.name,
        value: this.isSensitiveHeader(header.name)
          ? this.maskString(header.value)
          : header.value,
      }));
    }

    // Mask loginBody sensitive fields (password, secret, etc.)
    if (masked.loginBody) {
      masked.loginBody = this.maskLoginBody(masked.loginBody);
    }

    // Mask loginHeaders
    if (masked.loginHeaders) {
      masked.loginHeaders = Object.fromEntries(
        Object.entries(masked.loginHeaders).map(([key, value]) => [
          key,
          this.isSensitiveHeader(key) ? this.maskString(value) : value,
        ])
      );
    }

    return masked;
  }

  private maskString(value: string): string {
    if (value.length <= 8) {
      return '****';
    }
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
  }

  private isSensitiveHeader(headerName: string): boolean {
    const lower = headerName.toLowerCase();
    return (
      lower.includes('auth') ||
      lower.includes('secret') ||
      lower.includes('key') ||
      lower.includes('token') ||
      lower.includes('bearer') ||
      lower.includes('api-key') ||
      lower.includes('apikey')
    );
  }

  private maskLoginBody(
    body: Record<string, unknown>
  ): Record<string, unknown> {
    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'credential'];
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      const keyLower = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((s) => keyLower.includes(s));

      if (isSensitive && typeof value === 'string') {
        masked[key] = this.maskString(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}

// Singleton instance
let storageInstance: Storage | null = null;
let initializedStorageDir: string | undefined = undefined;

export async function getStorage(storageDir?: string): Promise<Storage> {
  if (!storageInstance) {
    initializedStorageDir = storageDir;
    storageInstance = new Storage(storageDir);
    await storageInstance.init();
  } else if (storageDir !== undefined && storageDir !== initializedStorageDir) {
    // Warn if trying to use different storage dir after initialization
    console.warn(
      `[Storage] Warning: Storage already initialized with path '${storageInstance.getStoragePath()}'. ` +
      `Ignoring requested storageDir '${storageDir}'. ` +
      `Storage is a singleton - restart the server to use a different path.`
    );
  }
  return storageInstance;
}

/**
 * Reset storage singleton for testing purposes.
 * WARNING: Only use this in tests - not for production code.
 */
export function resetStorageForTesting(): void {
  storageInstance = null;
  initializedStorageDir = undefined;
}
