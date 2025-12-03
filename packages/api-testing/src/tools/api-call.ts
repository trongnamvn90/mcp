/**
 * API Call tool - Execute HTTP requests against whitelisted APIs
 */

import { z } from 'zod';
import { getStorage } from '../utils/storage.js';
import { makeApiCall, validateUrlAgainstWhitelist, getCachedToken, clearCachedToken } from '../utils/api-client.js';
import { getEndpointInfo } from '../utils/openapi-parser.js';
import type { ApiCallResponse, Credential } from '../types/index.js';

/**
 * Apply credentials to headers for raw API calls
 * Handles all credential types including autoToken and customHeaders
 */
async function applyCredentialsToHeaders(
  headers: Record<string, string>,
  credential: Credential
): Promise<void> {
  const { type, config } = credential;

  switch (type) {
    case 'apiKey':
      if (config.apiKeyHeader && config.apiKey) {
        headers[config.apiKeyHeader] = config.apiKey;
      }
      break;

    case 'bearer':
      if (config.token) {
        headers['Authorization'] = `Bearer ${config.token}`;
      }
      break;

    case 'basic':
      if (config.username && config.password) {
        const encoded = Buffer.from(
          `${config.username}:${config.password}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;

    case 'oauth2':
      if (config.accessToken) {
        headers['Authorization'] = `Bearer ${config.accessToken}`;
      }
      break;

    case 'custom':
      if (config.headers) {
        Object.assign(headers, config.headers);
      }
      break;

    case 'customHeaders':
      if (config.customHeaders) {
        for (const header of config.customHeaders) {
          headers[header.name] = header.value;
        }
      }
      break;

    case 'autoToken': {
      // Get token from cache or perform login
      let token = getCachedToken(credential.id);

      if (!token) {
        // Need to login first
        token = await performAutoTokenLogin(credential);
      }

      const tokenHeader = config.tokenHeader || 'Authorization';
      const tokenPrefix = config.tokenPrefix ?? 'Bearer ';
      headers[tokenHeader] = `${tokenPrefix}${token}`;
      break;
    }
  }
}

/**
 * Perform login for autoToken credential
 */
async function performAutoTokenLogin(credential: Credential): Promise<string> {
  const { config } = credential;

  if (!config.loginUrl) {
    throw new Error('loginUrl is required for autoToken credential');
  }

  const loginHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...config.loginHeaders,
  };

  const fetchOptions: RequestInit = {
    method: config.loginMethod || 'POST',
    headers: loginHeaders,
  };

  if (config.loginBody && config.loginMethod !== 'GET') {
    fetchOptions.body = JSON.stringify(config.loginBody);
  }

  const response = await fetch(config.loginUrl, fetchOptions);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Login failed: ${response.status} ${response.statusText}. ${errorBody}`
    );
  }

  const responseBody = await response.json();
  const tokenPath = config.tokenPath || 'token';
  const token = getValueByPath(responseBody, tokenPath);

  if (!token || typeof token !== 'string') {
    throw new Error(
      `Failed to extract token from login response using path '${tokenPath}'`
    );
  }

  return token;
}

/**
 * Extract value from object using dot notation path
 */
function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

// Schemas for tool parameters
export const callApiSchema = z.object({
  apiDocId: z.string().describe('ID of the API doc to call'),
  path: z.string().describe('Endpoint path (e.g., "/users/{id}")'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .describe('HTTP method'),
  pathParams: z
    .record(z.string())
    .optional()
    .describe('Path parameters (e.g., { "id": "123" })'),
  queryParams: z
    .record(z.string())
    .optional()
    .describe('Query parameters'),
  headers: z
    .record(z.string())
    .optional()
    .describe('Additional headers'),
  body: z
    .unknown()
    .optional()
    .describe('Request body (for POST/PUT/PATCH)'),
  credentialId: z
    .string()
    .optional()
    .describe('ID of credential to use for authentication'),
});

export const callRawApiSchema = z.object({
  url: z.string().url().describe('Full URL to call (must be whitelisted)'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .describe('HTTP method'),
  headers: z
    .record(z.string())
    .optional()
    .describe('Request headers'),
  body: z
    .unknown()
    .optional()
    .describe('Request body'),
  credentialId: z
    .string()
    .optional()
    .describe('ID of credential to use'),
});

// Tool implementations
export async function callApi(
  params: z.infer<typeof callApiSchema>
): Promise<{
  success: boolean;
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    duration: number;
  };
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
  error?: string;
  suggestion?: string;
}> {
  try {
    const storage = await getStorage();

    // Get API doc
    const apiDoc = await storage.getApiDoc(params.apiDocId);
    if (!apiDoc) {
      return {
        success: false,
        error: `API doc '${params.apiDocId}' not found`,
        suggestion: 'Use list_api_docs to see available API docs',
      };
    }

    // Validate endpoint exists in API doc
    const endpoint = getEndpointInfo(apiDoc, params.path, params.method);
    if (!endpoint) {
      return {
        success: false,
        error: `Endpoint ${params.method} ${params.path} not found in '${params.apiDocId}'`,
        suggestion: `Use search_endpoints or list_endpoints to find available endpoints`,
      };
    }

    // Get credential if specified
    let credential;
    if (params.credentialId) {
      credential = await storage.getCredential(params.credentialId);
      if (!credential) {
        return {
          success: false,
          error: `Credential '${params.credentialId}' not found`,
          suggestion: 'Use list_credentials to see available credentials',
        };
      }
    }

    // Validate required path parameters
    const pathParamMatches = params.path.match(/\{(\w+)\}/g) || [];
    const requiredPathParams = pathParamMatches.map((p) =>
      p.replace(/[{}]/g, '')
    );

    for (const param of requiredPathParams) {
      if (!params.pathParams?.[param]) {
        return {
          success: false,
          error: `Missing required path parameter: ${param}`,
          suggestion: `Provide pathParams: { "${param}": "value" }`,
        };
      }
    }

    // Make the API call
    const response = await makeApiCall(
      {
        apiDocId: params.apiDocId,
        endpointPath: params.path,
        method: params.method,
        pathParams: params.pathParams,
        queryParams: params.queryParams,
        headers: params.headers,
        body: params.body,
        credentialId: params.credentialId,
      },
      apiDoc,
      credential
    );

    // Build request URL for logging
    let requestUrl = `${apiDoc.baseUrl}${params.path}`;
    if (params.pathParams) {
      for (const [key, value] of Object.entries(params.pathParams)) {
        requestUrl = requestUrl.replace(`{${key}}`, value);
      }
    }
    if (params.queryParams) {
      const queryString = new URLSearchParams(params.queryParams).toString();
      if (queryString) {
        requestUrl += `?${queryString}`;
      }
    }

    return {
      success: true,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        duration: response.timing.duration,
      },
      request: {
        url: requestUrl,
        method: params.method,
        headers: params.headers || {},
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute raw HTTP request and return parsed response
 */
async function executeRawRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
}> {
  const startTime = Date.now();
  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && !['GET', 'HEAD'].includes(method)) {
    fetchOptions.body =
      typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const endTime = Date.now();

  // Parse response headers
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  // Parse response body
  let responseBody: unknown;
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      const buffer = await response.arrayBuffer();
      responseBody = {
        _binary: true,
        size: buffer.byteLength,
        contentType,
      };
    }
  } catch {
    responseBody = await response.text().catch(() => null);
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
    duration: endTime - startTime,
  };
}

export async function callRawApi(
  params: z.infer<typeof callRawApiSchema>
): Promise<{
  success: boolean;
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    duration: number;
  };
  error?: string;
  suggestion?: string;
}> {
  try {
    const storage = await getStorage();
    const whitelistedUrls = storage.getWhitelistedBaseUrls();

    // Validate URL against whitelist
    const validation = validateUrlAgainstWhitelist(params.url, whitelistedUrls);

    if (!validation.valid) {
      return {
        success: false,
        error: `URL is not whitelisted: ${params.url}`,
        suggestion: `Add an API doc with this baseURL to whitelist it. Current whitelisted URLs: ${whitelistedUrls.join(', ') || 'none'}`,
      };
    }

    // Get credential if specified
    let credential;
    if (params.credentialId) {
      credential = await storage.getCredential(params.credentialId);
      if (!credential) {
        return {
          success: false,
          error: `Credential '${params.credentialId}' not found`,
        };
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...params.headers,
    };

    // Apply credentials (supports all types including autoToken and customHeaders)
    if (credential) {
      await applyCredentialsToHeaders(headers, credential);
    }

    // Make request with retry for autoToken
    let response = await executeRawRequest(params.url, params.method, headers, params.body);

    // Handle autoToken retry on invalid status
    if (
      credential?.type === 'autoToken' &&
      credential.config.invalidStatusCodes?.includes(response.status)
    ) {
      // Clear cached token and retry once
      clearCachedToken(credential.id);

      // Re-apply credentials (will trigger new login)
      const retryHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...params.headers,
      };
      await applyCredentialsToHeaders(retryHeaders, credential);

      // Retry request
      response = await executeRawRequest(params.url, params.method, retryHeaders, params.body);
    }

    return {
      success: true,
      response,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
