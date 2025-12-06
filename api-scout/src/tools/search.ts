/**
 * Search and Get Info tools for API endpoints
 */

import { z } from 'zod';
import { getStorage } from '../utils/storage.js';
import {
  searchEndpoints,
  getEndpointInfo,
  resolveSchema,
} from '../utils/openapi-parser.js';
import { checkAndRefreshApiDoc } from './smart-cache.js';
import type { ApiEndpoint, ApiSchema } from '../types/index.js';

// Schemas for tool parameters
export const searchEndpointsSchema = z.object({
  query: z.string().describe('Search query (searches in path, summary, description, tags)'),
  apiDocId: z.string().optional().describe('Limit search to specific API doc'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .optional()
    .describe('Filter by HTTP method'),
  tag: z.string().optional().describe('Filter by tag'),
  limit: z.number().optional().default(20).describe('Maximum results to return'),
});

export const getEndpointInfoSchema = z.object({
  apiDocId: z.string().describe('ID of the API doc'),
  path: z.string().describe('Endpoint path (e.g., "/users/{id}")'),
  method: z.string().describe('HTTP method (GET, POST, etc.)'),
  resolveSchemas: z
    .boolean()
    .optional()
    .default(true)
    .describe('Resolve $ref schema references'),
});

export const listEndpointsSchema = z.object({
  apiDocId: z.string().describe('ID of the API doc'),
  tag: z.string().optional().describe('Filter by tag'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .optional()
    .describe('Filter by HTTP method'),
  limit: z.number().optional().default(50).describe('Maximum results to return'),
  offset: z.number().optional().default(0).describe('Offset for pagination'),
});

export const listTagsSchema = z.object({
  apiDocId: z.string().describe('ID of the API doc'),
});

// Tool implementations
export async function searchApiEndpoints(
  params: z.infer<typeof searchEndpointsSchema>
): Promise<{
  results: Array<{
    apiDocId: string;
    apiDocName: string;
    method: string;
    path: string;
    summary?: string;
    tags?: string[];
    score: number;
    matchedFields: string[];
  }>;
  totalFound: number;
}> {
  const storage = await getStorage();

  // Smart cache check if searching specific doc
  if (params.apiDocId) {
    await checkAndRefreshApiDoc(params.apiDocId);
  }

  const apiDocs = await storage.getApiDocs();

  const results = searchEndpoints(apiDocs, params.query, {
    apiDocId: params.apiDocId,
    method: params.method,
    tag: params.tag,
  });

  const limited = results.slice(0, params.limit);

  return {
    results: limited.map((r) => ({
      apiDocId: r.apiDocId,
      apiDocName: r.apiDocName,
      method: r.endpoint.method,
      path: r.endpoint.path,
      summary: r.endpoint.summary,
      tags: r.endpoint.tags,
      score: r.score,
      matchedFields: r.matchedFields,
    })),
    totalFound: results.length,
  };
}

export async function getApiEndpointInfo(
  params: z.infer<typeof getEndpointInfoSchema>
): Promise<{
  success: boolean;
  endpoint?: {
    method: string;
    path: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: Array<{
      name: string;
      in: string;
      required?: boolean;
      description?: string;
      schema?: ApiSchema;
      example?: unknown;
    }>;
    requestBody?: {
      description?: string;
      required?: boolean;
      contentTypes: string[];
      schema?: ApiSchema;
      example?: unknown;
    };
    responses?: Record<
      string,
      {
        description?: string;
        contentTypes?: string[];
        schema?: ApiSchema;
      }
    >;
    security?: Array<Record<string, string[]>>;
    curlExample?: string;
  };
  error?: string;
}> {
  try {
    // Smart cache check
    await checkAndRefreshApiDoc(params.apiDocId);

    const storage = await getStorage();
    const apiDoc = await storage.getApiDoc(params.apiDocId);

    if (!apiDoc) {
      return {
        success: false,
        error: `API doc '${params.apiDocId}' not found`,
      };
    }

    const endpoint = getEndpointInfo(apiDoc, params.path, params.method);

    if (!endpoint) {
      return {
        success: false,
        error: `Endpoint ${params.method.toUpperCase()} ${params.path} not found in '${params.apiDocId}'`,
      };
    }

    // Process request body
    let requestBodyInfo:
      | {
        description?: string;
        required?: boolean;
        contentTypes: string[];
        schema?: ApiSchema;
        example?: unknown;
      }
      | undefined;

    if (endpoint.requestBody?.content) {
      const contentTypes = Object.keys(endpoint.requestBody.content);
      const primaryContent =
        endpoint.requestBody.content['application/json'] ||
        Object.values(endpoint.requestBody.content)[0];

      let schema = primaryContent?.schema;
      if (params.resolveSchemas && schema) {
        schema = resolveSchema(apiDoc, schema);
      }

      requestBodyInfo = {
        description: endpoint.requestBody.description,
        required: endpoint.requestBody.required,
        contentTypes,
        schema,
        example: primaryContent?.example,
      };
    }

    // Process responses
    const responsesInfo: Record<
      string,
      {
        description?: string;
        contentTypes?: string[];
        schema?: ApiSchema;
      }
    > = {};

    if (endpoint.responses) {
      for (const [statusCode, response] of Object.entries(endpoint.responses)) {
        const contentTypes = response.content
          ? Object.keys(response.content)
          : undefined;
        const primaryContent = response.content
          ? response.content['application/json'] ||
          Object.values(response.content)[0]
          : undefined;

        let schema = primaryContent?.schema;
        if (params.resolveSchemas && schema) {
          schema = resolveSchema(apiDoc, schema);
        }

        responsesInfo[statusCode] = {
          description: response.description,
          contentTypes,
          schema,
        };
      }
    }

    // Process parameters
    const parameters = endpoint.parameters?.map((param) => {
      let schema = param.schema;
      if (params.resolveSchemas && schema) {
        schema = resolveSchema(apiDoc, schema);
      }
      return { ...param, schema };
    });

    // Generate curl example
    const curlExample = generateCurlExample(apiDoc.baseUrl, endpoint);

    return {
      success: true,
      endpoint: {
        method: endpoint.method,
        path: endpoint.path,
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters,
        requestBody: requestBodyInfo,
        responses: responsesInfo,
        security: endpoint.security,
        curlExample,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listApiEndpoints(
  params: z.infer<typeof listEndpointsSchema>
): Promise<{
  success: boolean;
  endpoints?: Array<{
    method: string;
    path: string;
    summary?: string;
    tags?: string[];
  }>;
  total?: number;
  error?: string;
}> {
  try {
    // Smart cache check
    await checkAndRefreshApiDoc(params.apiDocId);

    const storage = await getStorage();
    const apiDoc = await storage.getApiDoc(params.apiDocId);

    if (!apiDoc) {
      return {
        success: false,
        error: `API doc '${params.apiDocId}' not found`,
      };
    }

    let endpoints = apiDoc.endpoints;

    // Apply filters
    if (params.tag) {
      endpoints = endpoints.filter((ep) => ep.tags?.includes(params.tag!));
    }

    if (params.method) {
      endpoints = endpoints.filter(
        (ep) => ep.method.toUpperCase() === params.method!.toUpperCase()
      );
    }

    const total = endpoints.length;

    // Apply pagination
    endpoints = endpoints.slice(params.offset, params.offset + params.limit);

    return {
      success: true,
      endpoints: endpoints.map((ep) => ({
        method: ep.method,
        path: ep.path,
        summary: ep.summary,
        tags: ep.tags,
      })),
      total,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listApiTags(
  params: z.infer<typeof listTagsSchema>
): Promise<{
  success: boolean;
  tags?: Array<{ name: string; endpointCount: number }>;
  error?: string;
}> {
  try {
    // Smart cache check
    await checkAndRefreshApiDoc(params.apiDocId);

    const storage = await getStorage();
    const apiDoc = await storage.getApiDoc(params.apiDocId);

    if (!apiDoc) {
      return {
        success: false,
        error: `API doc '${params.apiDocId}' not found`,
      };
    }

    const tagCounts = new Map<string, number>();

    for (const endpoint of apiDoc.endpoints) {
      for (const tag of endpoint.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const tags = Array.from(tagCounts.entries())
      .map(([name, endpointCount]) => ({ name, endpointCount }))
      .sort((a, b) => b.endpointCount - a.endpointCount);

    return { success: true, tags };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function generateCurlExample(baseUrl: string, endpoint: ApiEndpoint): string {
  let curl = `curl -X ${endpoint.method}`;

  // Build URL with path params as placeholders
  let url = `${baseUrl}${endpoint.path}`;

  // Add query params
  const queryParams = endpoint.parameters?.filter((p) => p.in === 'query') || [];
  if (queryParams.length > 0) {
    const queryString = queryParams
      .map((p) => `${p.name}={${p.name}}`)
      .join('&');
    url += `?${queryString}`;
  }

  curl += ` "${url}"`;

  // Add headers
  const headerParams =
    endpoint.parameters?.filter((p) => p.in === 'header') || [];
  for (const header of headerParams) {
    curl += ` \\\n  -H "${header.name}: {${header.name}}"`;
  }

  // Add content-type and body placeholder for POST/PUT/PATCH
  if (
    ['POST', 'PUT', 'PATCH'].includes(endpoint.method) &&
    endpoint.requestBody
  ) {
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -d '{...}'`;
  }

  return curl;
}
