/**
 * API Client for making HTTP requests
 * Supports autoToken with automatic login and token refresh
 */

import type {
  ApiCallRequest,
  ApiCallResponse,
  Credential,
  ApiDoc,
  TokenCache,
} from '../types/index.js';

// In-memory token cache
const tokenCache = new Map<string, TokenCache>();

/**
 * Get cached token for a credential
 */
export function getCachedToken(credentialId: string): string | undefined {
  return tokenCache.get(credentialId)?.token;
}

/**
 * Clear cached token for a credential
 */
export function clearCachedToken(credentialId: string): void {
  tokenCache.delete(credentialId);
}

/**
 * Extract value from object using dot notation path
 * e.g., "data.token" from { data: { token: "xxx" } }
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || typeof path !== 'string') {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object' || Array.isArray(current)) {
      // Cannot traverse non-object or array with dot notation
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      // Key doesn't exist
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Perform login request to obtain token
 */
async function performLogin(credential: Credential): Promise<string> {
  const { config } = credential;

  if (!config.loginUrl) {
    throw new Error('loginUrl is required for autoToken credential');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...config.loginHeaders,
  };

  const fetchOptions: RequestInit = {
    method: config.loginMethod || 'POST',
    headers,
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
      `Failed to extract token from login response using path '${tokenPath}'. Response: ${JSON.stringify(responseBody).substring(0, 200)}`
    );
  }

  // Cache the token
  tokenCache.set(credential.id, {
    credentialId: credential.id,
    token,
    obtainedAt: Date.now(),
  });

  return token;
}

/**
 * Check if token is valid using validity check endpoint
 */
async function checkTokenValidity(
  credential: Credential,
  token: string
): Promise<boolean> {
  const { config } = credential;

  if (!config.validityCheckUrl) {
    return true; // No validity check configured, assume valid
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Apply token to headers
  const tokenHeader = config.tokenHeader || 'Authorization';
  const tokenPrefix = config.tokenPrefix ?? 'Bearer ';
  headers[tokenHeader] = `${tokenPrefix}${token}`;

  try {
    const response = await fetch(config.validityCheckUrl, {
      method: config.validityCheckMethod || 'GET',
      headers,
    });

    const invalidCodes = config.invalidStatusCodes || [401, 403];
    return !invalidCodes.includes(response.status);
  } catch {
    return false;
  }
}

/**
 * Get valid token for autoToken credential
 * - Returns cached token if valid
 * - Performs login if no token or token invalid
 */
async function getAutoToken(credential: Credential): Promise<string> {
  const cached = tokenCache.get(credential.id);

  if (cached?.token) {
    // Check validity if configured
    const isValid = await checkTokenValidity(credential, cached.token);
    if (isValid) {
      return cached.token;
    }
    // Token invalid, clear cache
    tokenCache.delete(credential.id);
  }

  // Perform login to get new token
  return performLogin(credential);
}

/**
 * Apply credentials to request headers
 */
export async function applyCredentials(
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
      const token = await getAutoToken(credential);
      const tokenHeader = config.tokenHeader || 'Authorization';
      const tokenPrefix = config.tokenPrefix ?? 'Bearer ';
      headers[tokenHeader] = `${tokenPrefix}${token}`;
      break;
    }
  }
}

/**
 * Make API call with optional credential and auto-retry for autoToken
 */
export async function makeApiCall(
  request: ApiCallRequest,
  apiDoc: ApiDoc,
  credential?: Credential
): Promise<ApiCallResponse> {
  const { endpointPath, method, pathParams, queryParams, headers, body } =
    request;

  // Build the URL
  const url = buildUrl(apiDoc.baseUrl, endpointPath, pathParams, queryParams);

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...headers,
  };

  // Apply credentials
  if (credential) {
    await applyCredentials(requestHeaders, credential);
  }

  // Make the request
  const response = await executeRequest(url, method, requestHeaders, body);

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
      ...headers,
    };
    await applyCredentials(retryHeaders, credential);

    // Retry request
    return executeRequest(url, method, retryHeaders, body);
  }

  return response;
}

/**
 * Execute the actual HTTP request
 */
export async function executeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<ApiCallResponse> {
  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers,
  };

  // Add body for non-GET requests
  if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
    fetchOptions.body =
      typeof body === 'string' ? body : JSON.stringify(body);
  }

  const startTime = Date.now();
  let response: Response;

  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    throw new Error(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  const endTime = Date.now();

  // Parse response
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let responseBody: unknown;
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType.includes('text/')) {
      responseBody = await response.text();
    } else {
      // For binary data, return info about it
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
    timing: {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
    },
  };
}

function buildUrl(
  baseUrl: string,
  path: string,
  pathParams?: Record<string, string>,
  queryParams?: Record<string, string>
): string {
  // Replace path parameters
  let resolvedPath = path;
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
    }
  }

  // Build full URL
  const url = new URL(resolvedPath, baseUrl);

  // Add query parameters
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.append(key, value);
    }
  }

  return url.toString();
}

export function validateUrlAgainstWhitelist(
  url: string,
  whitelistedBaseUrls: string[]
): { valid: boolean; matchedBaseUrl?: string } {
  try {
    const parsedUrl = new URL(url);
    const urlOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;

    for (const baseUrl of whitelistedBaseUrls) {
      try {
        const parsedBase = new URL(baseUrl);
        const baseOrigin = `${parsedBase.protocol}//${parsedBase.host}`;

        if (urlOrigin === baseOrigin) {
          // Check if path starts with base path
          if (parsedUrl.pathname.startsWith(parsedBase.pathname)) {
            return { valid: true, matchedBaseUrl: baseUrl };
          }
        }
      } catch {
        continue;
      }
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}
