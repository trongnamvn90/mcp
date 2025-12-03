/**
 * API Call tool - Execute HTTP requests against whitelisted APIs
 */

import { z } from 'zod';
import { getStorage } from '../utils/storage.js';
import { makeApiCall, validateUrlAgainstWhitelist } from '../utils/api-client.js';
import { getEndpointInfo } from '../utils/openapi-parser.js';
import type { ApiCallResponse } from '../types/index.js';

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

    // Apply credentials
    if (credential) {
      switch (credential.type) {
        case 'apiKey':
          if (credential.config.apiKeyHeader && credential.config.apiKey) {
            headers[credential.config.apiKeyHeader] = credential.config.apiKey;
          }
          break;
        case 'bearer':
          if (credential.config.token) {
            headers['Authorization'] = `Bearer ${credential.config.token}`;
          }
          break;
        case 'basic':
          if (credential.config.username && credential.config.password) {
            const encoded = Buffer.from(
              `${credential.config.username}:${credential.config.password}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${encoded}`;
          }
          break;
        case 'oauth2':
          if (credential.config.accessToken) {
            headers['Authorization'] = `Bearer ${credential.config.accessToken}`;
          }
          break;
        case 'custom':
          if (credential.config.headers) {
            Object.assign(headers, credential.config.headers);
          }
          break;
      }
    }

    // Make request
    const startTime = Date.now();
    const fetchOptions: RequestInit = {
      method: params.method,
      headers,
    };

    if (params.body && !['GET', 'HEAD'].includes(params.method)) {
      fetchOptions.body =
        typeof params.body === 'string'
          ? params.body
          : JSON.stringify(params.body);
    }

    const response = await fetch(params.url, fetchOptions);
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
      success: true,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        duration: endTime - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
