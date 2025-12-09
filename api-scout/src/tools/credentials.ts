/**
 * Credentials management tools
 * Store and manage authentication credentials for API calls
 */

import { z } from 'zod';
import { getStorage } from '../utils/storage.js';
import type { Credential, CredentialConfig } from '../types/index.js';
import { testCredentialLogin } from '../utils/api-client.js';

// Custom header schema (for customHeaders type)
const customHeaderSchema = z.object({
  name: z.string().describe('Header name'),
  value: z.string().describe('Header value'),
});

// Schemas for tool parameters
export const addCredentialSchema = z.object({
  id: z.string().describe('Unique identifier for the credential'),
  name: z.string().describe('Display name for the credential'),
  type: z
    .enum(['apiKey', 'bearer', 'basic', 'oauth2', 'custom', 'customHeaders'])
    .describe('Authentication type'),
  apiDocId: z
    .string()
    .optional()
    .describe('Associate with specific API doc (optional)'),

  // API Key config
  apiKey: z.string().optional().describe('API key value (for apiKey type)'),
  apiKeyHeader: z
    .string()
    .optional()
    .default('X-API-Key')
    .describe('Header name for API key (default: X-API-Key)'),

  // Bearer config
  token: z.string().optional().describe('Bearer token (for bearer type)'),

  // Basic auth config
  username: z.string().optional().describe('Username (for basic type)'),
  password: z.string().optional().describe('Password (for basic type)'),

  // OAuth2 config
  clientId: z.string().optional().describe('OAuth2 client ID'),
  clientSecret: z.string().optional().describe('OAuth2 client secret'),
  accessToken: z.string().optional().describe('OAuth2 access token'),
  refreshToken: z.string().optional().describe('OAuth2 refresh token'),
  tokenUrl: z.string().optional().describe('OAuth2 token endpoint URL'),

  // Legacy custom headers (for custom type)
  headers: z
    .record(z.string())
    .optional()
    .describe('Custom headers as object (for custom type)'),

  // New customHeaders type (1-5 headers)
  customHeaders: z
    .array(customHeaderSchema)
    .min(1)
    .max(5)
    .optional()
    .describe('Array of 1-5 custom headers (for customHeaders type)'),

  // Smart Bearer config
  refreshUrl: z
    .string()
    .url()
    .optional()
    .describe('Refresh endpoint URL'),
  refreshMethod: z
    .enum(['GET', 'POST'])
    .optional()
    .default('POST')
    .describe('HTTP method for refresh (default: POST)'),
  refreshTokenPath: z
    .string()
    .optional()
    .describe('JSON path to extract refresh token'),

  // Smart Bearer config
  loginUrl: z
    .string()
    .url()
    .optional()
    .describe('Login endpoint URL (for Smart Bearer)'),
  loginMethod: z
    .enum(['GET', 'POST'])
    .optional()
    .default('POST')
    .describe('HTTP method for login (default: POST)'),
  loginBody: z
    .record(z.unknown())
    .optional()
    .describe('Login request body, e.g., { "username": "xxx", "password": "yyy" }'),
  loginHeaders: z
    .record(z.string())
    .optional()
    .describe('Additional headers for login request'),
  tokenPath: z
    .string()
    .optional()
    .default('token')
    .describe('JSON path to extract token from response (e.g., "data.token" or "token")'),
  tokenHeader: z
    .string()
    .optional()
    .default('Authorization')
    .describe('Header name to send token (default: Authorization)'),
  tokenPrefix: z
    .string()
    .optional()
    .default('Bearer ')
    .describe('Prefix for token value (default: "Bearer ")'),
  invalidStatusCodes: z
    .array(z.number())
    .optional()
    .default([401, 403])
    .describe('Status codes indicating invalid token (default: [401, 403])'),
  validityCheckUrl: z
    .string()
    .url()
    .optional()
    .describe('Optional URL to check token validity before API calls'),
  validityCheckMethod: z
    .enum(['GET', 'POST'])
    .optional()
    .default('GET')
    .describe('HTTP method for validity check (default: GET)'),
  skipValidityCheck: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Skip verification of credential login (for Smart Bearer)'
    ),
});

export const updateCredentialSchema = z.object({
  id: z.string().describe('ID of the credential to update'),
  name: z.string().optional().describe('New display name'),
  apiKey: z.string().optional().describe('New API key value'),
  token: z.string().optional().describe('New bearer token'),
  username: z.string().optional().describe('New username'),
  password: z.string().optional().describe('New password'),
  accessToken: z.string().optional().describe('New access token'),
  refreshToken: z.string().optional().describe('New refresh token'),
  headers: z.record(z.string()).optional().describe('New custom headers'),
  customHeaders: z
    .array(customHeaderSchema)
    .min(1)
    .max(5)
    .optional()
    .describe('New custom headers array (1-5)'),
  loginBody: z
    .record(z.unknown())
    .optional()
    .describe('New login body (for Smart Bearer)'),
  invalidStatusCodes: z
    .array(z.number())
    .optional()
    .describe('New invalid status codes'),
  refreshUrl: z.string().optional(),
  refreshMethod: z.enum(['GET', 'POST']).optional(),
  refreshTokenPath: z.string().optional(),
  loginUrl: z.string().optional(),
  loginMethod: z.enum(['GET', 'POST']).optional(),
  tokenPath: z.string().optional(),
  skipValidityCheck: z.boolean().optional().describe('Skip verification of credential login'),
});

export const removeCredentialSchema = z.object({
  id: z.string().describe('ID of the credential to remove'),
});

export const listCredentialsSchema = z.object({
  apiDocId: z
    .string()
    .optional()
    .describe('Filter by associated API doc'),
});

export const getCredentialSchema = z.object({
  id: z.string().describe('ID of the credential to get'),
});

// Tool implementations
export async function addCredential(
  params: z.infer<typeof addCredentialSchema>
): Promise<{
  success: boolean;
  credential?: Partial<Credential>;
  error?: string;
}> {
  try {
    const storage = await getStorage();

    // Check if ID already exists
    const existing = await storage.getCredential(params.id);
    if (existing) {
      return {
        success: false,
        error: `Credential '${params.id}' already exists`,
      };
    }

    // Build credential config based on type
    const config: CredentialConfig = {};

    switch (params.type) {
      case 'apiKey':
        if (!params.apiKey) {
          return {
            success: false,
            error: 'apiKey is required for apiKey type',
          };
        }
        config.apiKey = params.apiKey;
        config.apiKeyHeader = params.apiKeyHeader || 'X-API-Key';
        break;

      case 'bearer':
        // Allow starting with either token OR login capability
        if (!params.token && !params.loginUrl) {
          return {
            success: false,
            error: 'Either token or loginUrl is required for bearer type',
          };
        }

        if (params.token) config.token = params.token;

        // Copy smart bearer config
        if (params.loginUrl) {
          if (!params.loginBody) {
            return { success: false, error: 'loginBody is required when loginUrl is provided' };
          }
          config.loginUrl = params.loginUrl;
          config.loginMethod = params.loginMethod || 'POST';
          config.loginBody = params.loginBody;
          config.loginHeaders = params.loginHeaders;
          config.tokenPath = params.tokenPath || 'token';
          config.tokenHeader = params.tokenHeader || 'Authorization';
          config.tokenPrefix = params.tokenPrefix ?? 'Bearer ';
          config.invalidStatusCodes = params.invalidStatusCodes || [401, 403];

          if (params.validityCheckUrl) {
            config.validityCheckUrl = params.validityCheckUrl;
            config.validityCheckMethod = params.validityCheckMethod || 'GET';
          }
        }

        if (params.refreshUrl) {
          config.refreshUrl = params.refreshUrl;
          config.refreshMethod = params.refreshMethod || 'POST';
          config.refreshTokenPath = params.refreshTokenPath;
          // Ensure invalidStatusCodes is set if not already
          if (!config.invalidStatusCodes) {
            config.invalidStatusCodes = params.invalidStatusCodes || [401, 403];
          }
        }
        break;

      case 'basic':
        if (!params.username || !params.password) {
          return {
            success: false,
            error: 'username and password are required for basic type',
          };
        }
        config.username = params.username;
        config.password = params.password;
        break;

      case 'oauth2':
        if (!params.accessToken && !params.clientId) {
          return {
            success: false,
            error:
              'accessToken or clientId/clientSecret are required for oauth2 type',
          };
        }
        config.clientId = params.clientId;
        config.clientSecret = params.clientSecret;
        config.accessToken = params.accessToken;
        config.refreshToken = params.refreshToken;
        config.tokenUrl = params.tokenUrl;
        break;

      case 'custom':
        if (!params.headers || Object.keys(params.headers).length === 0) {
          return {
            success: false,
            error: 'headers are required for custom type',
          };
        }
        config.headers = params.headers;
        break;

      case 'customHeaders':
        if (!params.customHeaders || params.customHeaders.length === 0) {
          return {
            success: false,
            error: 'customHeaders (1-5 headers) are required for customHeaders type',
          };
        }
        if (params.customHeaders.length > 5) {
          return {
            success: false,
            error: 'customHeaders type supports maximum 5 headers',
          };
        }
        config.customHeaders = params.customHeaders;
        break;


    }

    const credential: Credential = {
      id: params.id,
      name: params.name,
      type: params.type,
      apiDocId: params.apiDocId,
      config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Verify credential if it is a Smart Bearer (has loginUrl) and not skipped
    if (config.loginUrl && !params.skipValidityCheck) {
      try {
        await testCredentialLogin(credential);
      } catch (error) {
        return {
          success: false,
          error: `Credential verification failed: ${error instanceof Error ? error.message : String(error)
            }. Use skipValidityCheck=true to force save.`,
        };
      }
    }

    const saved = await storage.addCredential(credential);

    return {
      success: true,
      credential: {
        id: saved.id,
        name: saved.name,
        type: saved.type,
        apiDocId: saved.apiDocId,
        createdAt: saved.createdAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateCredential(
  params: z.infer<typeof updateCredentialSchema>
): Promise<{
  success: boolean;
  credential?: Partial<Credential>;
  error?: string;
}> {
  try {
    const storage = await getStorage();
    const existing = await storage.getCredential(params.id);

    if (!existing) {
      return {
        success: false,
        error: `Credential '${params.id}' not found`,
      };
    }

    // Update config based on what's provided
    const newConfig = { ...existing.config };

    if (params.apiKey !== undefined) newConfig.apiKey = params.apiKey;
    if (params.token !== undefined) newConfig.token = params.token;
    if (params.username !== undefined) newConfig.username = params.username;
    if (params.password !== undefined) newConfig.password = params.password;
    if (params.accessToken !== undefined)
      newConfig.accessToken = params.accessToken;
    if (params.refreshToken !== undefined)
      newConfig.refreshToken = params.refreshToken;
    if (params.headers !== undefined) newConfig.headers = params.headers;
    if (params.customHeaders !== undefined) {
      if (params.customHeaders.length > 5) {
        return {
          success: false,
          error: 'customHeaders supports maximum 5 headers',
        };
      }
      newConfig.customHeaders = params.customHeaders;
    }
    if (params.loginBody !== undefined) newConfig.loginBody = params.loginBody;
    if (params.invalidStatusCodes !== undefined)
      newConfig.invalidStatusCodes = params.invalidStatusCodes;
    if (params.refreshUrl !== undefined) newConfig.refreshUrl = params.refreshUrl;
    if (params.refreshMethod !== undefined) newConfig.refreshMethod = params.refreshMethod;
    if (params.refreshTokenPath !== undefined) newConfig.refreshTokenPath = params.refreshTokenPath;
    if (params.loginUrl !== undefined) newConfig.loginUrl = params.loginUrl;
    if (params.loginMethod !== undefined) newConfig.loginMethod = params.loginMethod;
    if (params.tokenPath !== undefined) newConfig.tokenPath = params.tokenPath;

    const updates: Partial<Credential> = {
      config: newConfig,
    };

    if (params.name !== undefined) {
      updates.name = params.name;
    }

    // Verify credential if it is a Smart Bearer (has loginUrl) and not skipped
    // We construct a temporary full credential object to test
    if (newConfig.loginUrl && !params.skipValidityCheck) {
      if (
        updates.config?.loginUrl ||
        updates.config?.loginMethod ||
        updates.config?.loginBody ||
        updates.config?.loginHeaders ||
        updates.config?.refreshUrl
      ) {
        // Only verify if we are changing login-related configs or validty settings
        // But actually, we should verify regardless if we are about to save it and it claims to be smart.
        // Or should we only verify if params touched it?
        // Let's verify if `skipValidityCheck` is false (default).
        // Construct temporary object
        const tempCredential: Credential = {
          ...existing,
          ...updates,
          config: newConfig,
        };

        try {
          await testCredentialLogin(tempCredential);
        } catch (error) {
          return {
            success: false,
            error: `Credential verification failed: ${error instanceof Error ? error.message : String(error)
              }. Use skipValidityCheck=true to force save.`,
          };
        }
      }
    }

    const updated = await storage.updateCredential(params.id, updates);

    return {
      success: true,
      credential: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        apiDocId: updated.apiDocId,
        updatedAt: updated.updatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function removeCredential(
  params: z.infer<typeof removeCredentialSchema>
): Promise<{ success: boolean; message: string }> {
  try {
    const storage = await getStorage();
    const removed = await storage.removeCredential(params.id);

    if (removed) {
      return {
        success: true,
        message: `Credential '${params.id}' removed successfully`,
      };
    } else {
      return {
        success: false,
        message: `Credential '${params.id}' not found`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listCredentials(
  params: z.infer<typeof listCredentialsSchema>
): Promise<{
  credentials: Array<{
    id: string;
    name: string;
    type: string;
    apiDocId?: string;
    createdAt: string;
  }>;
}> {
  const storage = await getStorage();
  let credentials = await storage.getCredentials();

  // Filter by apiDocId if provided
  if (params.apiDocId) {
    credentials = credentials.filter(
      (cred) => cred.apiDocId === params.apiDocId
    );
  }

  return {
    credentials: credentials.map((cred) => ({
      id: cred.id,
      name: cred.name,
      type: cred.type,
      apiDocId: cred.apiDocId,
      createdAt: cred.createdAt,
    })),
  };
}

export async function getCredentialInfo(
  params: z.infer<typeof getCredentialSchema>
): Promise<{
  success: boolean;
  credential?: {
    id: string;
    name: string;
    type: string;
    apiDocId?: string;
    config: CredentialConfig;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}> {
  try {
    const storage = await getStorage();
    const credentials = await storage.getCredentials();
    const credential = credentials.find((c) => c.id === params.id);

    if (!credential) {
      return {
        success: false,
        error: `Credential '${params.id}' not found`,
      };
    }

    return {
      success: true,
      credential: {
        id: credential.id,
        name: credential.name,
        type: credential.type,
        apiDocId: credential.apiDocId,
        config: credential.config, // Already masked by storage
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
