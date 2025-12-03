/**
 * API Client for making HTTP requests
 */

import type {
  ApiCallRequest,
  ApiCallResponse,
  Credential,
  ApiDoc,
} from '../types/index.js';

export async function makeApiCall(
  request: ApiCallRequest,
  apiDoc: ApiDoc,
  credential?: Credential
): Promise<ApiCallResponse> {
  const { endpointPath, method, pathParams, queryParams, headers, body } =
    request;

  // Build the URL
  let url = buildUrl(apiDoc.baseUrl, endpointPath, pathParams, queryParams);

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...headers,
  };

  // Apply credentials
  if (credential) {
    applyCredentials(requestHeaders, credential);
  }

  // Prepare request options
  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: requestHeaders,
  };

  // Add body for non-GET requests
  if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
    fetchOptions.body =
      typeof body === 'string' ? body : JSON.stringify(body);
  }

  // Make the request
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

function applyCredentials(
  headers: Record<string, string>,
  credential: Credential
): void {
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
  }
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
