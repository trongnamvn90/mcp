/**
 * OpenAPI/Swagger specification parser
 */

import type {
  ApiDoc,
  ApiEndpoint,
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  ApiSchema,
  SecurityScheme,
} from '../types/index.js';
import YAML from 'yaml';

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths?: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, ApiSchema>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  definitions?: Record<string, ApiSchema>;
  securityDefinitions?: Record<string, SecurityScheme>;
}

interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
  parameters?: ApiParameter[];
}

interface OperationObject {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<string, ApiResponse>;
  security?: Array<Record<string, string[]>>;
}

export async function parseOpenAPIFromUrl(url: string): Promise<{
  spec: OpenAPISpec;
  content: string;
}> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
  }

  const content = await response.text();
  return { spec: parseOpenAPIContent(content), content };
}

export function parseOpenAPIContent(content: string): OpenAPISpec {
  // Try JSON first, then YAML
  try {
    return JSON.parse(content);
  } catch {
    try {
      return YAML.parse(content);
    } catch {
      throw new Error('Failed to parse OpenAPI spec as JSON or YAML');
    }
  }
}

export function extractApiDoc(
  spec: OpenAPISpec,
  id: string,
  name: string,
  specUrl?: string
): ApiDoc {
  const baseUrl = extractBaseUrl(spec);
  const endpoints = extractEndpoints(spec);
  const schemas = spec.components?.schemas || spec.definitions || {};
  const securitySchemes =
    spec.components?.securitySchemes || spec.securityDefinitions || {};

  return {
    id,
    name: name || spec.info?.title || id,
    baseUrl,
    specUrl,
    version: spec.info?.version,
    description: spec.info?.description,
    endpoints,
    schemas,
    securitySchemes,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function extractBaseUrl(spec: OpenAPISpec): string {
  // OpenAPI 3.x
  if (spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url;
  }

  // Swagger 2.x
  if (spec.host) {
    const scheme = spec.schemes?.[0] || 'https';
    const basePath = spec.basePath || '';
    return `${scheme}://${spec.host}${basePath}`;
  }

  return '';
}

function extractEndpoints(spec: OpenAPISpec): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const paths = spec.paths || {};

  const methods = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
  ] as const;

  for (const [path, pathItem] of Object.entries(paths)) {
    const pathParams = pathItem.parameters || [];

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const endpoint: ApiEndpoint = {
        path,
        method: method.toUpperCase() as ApiEndpoint['method'],
        summary: operation.summary,
        description: operation.description,
        parameters: [...pathParams, ...(operation.parameters || [])],
        requestBody: operation.requestBody,
        responses: operation.responses,
        tags: operation.tags,
        security: operation.security,
      };

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

export function searchEndpoints(
  apiDocs: ApiDoc[],
  query: string,
  options?: {
    method?: string;
    tag?: string;
    apiDocId?: string;
  }
): Array<{
  apiDocId: string;
  apiDocName: string;
  endpoint: ApiEndpoint;
  score: number;
  matchedFields: string[];
}> {
  const results: Array<{
    apiDocId: string;
    apiDocName: string;
    endpoint: ApiEndpoint;
    score: number;
    matchedFields: string[];
  }> = [];

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);

  for (const apiDoc of apiDocs) {
    if (options?.apiDocId && apiDoc.id !== options.apiDocId) continue;

    for (const endpoint of apiDoc.endpoints) {
      if (
        options?.method &&
        endpoint.method.toLowerCase() !== options.method.toLowerCase()
      ) {
        continue;
      }

      if (options?.tag && !endpoint.tags?.includes(options.tag)) {
        continue;
      }

      let score = 0;
      const matchedFields: string[] = [];

      // Search in path
      if (endpoint.path.toLowerCase().includes(queryLower)) {
        score += 10;
        matchedFields.push('path');
      }

      // Search in summary
      if (endpoint.summary?.toLowerCase().includes(queryLower)) {
        score += 8;
        matchedFields.push('summary');
      }

      // Search in description
      if (endpoint.description?.toLowerCase().includes(queryLower)) {
        score += 5;
        matchedFields.push('description');
      }

      // Search in tags
      if (
        endpoint.tags?.some((tag) => tag.toLowerCase().includes(queryLower))
      ) {
        score += 6;
        matchedFields.push('tags');
      }

      // Search in parameters
      if (
        endpoint.parameters?.some(
          (param) =>
            param.name.toLowerCase().includes(queryLower) ||
            param.description?.toLowerCase().includes(queryLower)
        )
      ) {
        score += 4;
        matchedFields.push('parameters');
      }

      // Boost score for matching multiple query terms (only when query has multiple terms)
      if (queryTerms.length > 1) {
        for (const term of queryTerms) {
          if (endpoint.path.toLowerCase().includes(term)) score += 2;
          if (endpoint.summary?.toLowerCase().includes(term)) score += 1;
        }
      }

      if (score > 0) {
        results.push({
          apiDocId: apiDoc.id,
          apiDocName: apiDoc.name,
          endpoint,
          score,
          matchedFields,
        });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

export function getEndpointInfo(
  apiDoc: ApiDoc,
  path: string,
  method: string
): ApiEndpoint | undefined {
  return apiDoc.endpoints.find(
    (ep) =>
      ep.path === path && ep.method.toLowerCase() === method.toLowerCase()
  );
}

const MAX_SCHEMA_DEPTH = 50; // Prevent stack overflow from deeply nested schemas

export function resolveSchema(
  apiDoc: ApiDoc,
  schema: ApiSchema,
  visitedRefs: Set<string> = new Set(),
  depth: number = 0
): ApiSchema {
  // Prevent stack overflow from excessive recursion
  if (depth >= MAX_SCHEMA_DEPTH) {
    return { ...schema, _maxDepthReached: true };
  }

  if (schema.$ref) {
    // Detect circular reference
    if (visitedRefs.has(schema.$ref)) {
      return { ...schema, _circular: true };
    }

    const refPath = schema.$ref.replace('#/components/schemas/', '').replace('#/definitions/', '');
    const resolved = apiDoc.schemas?.[refPath];
    if (resolved) {
      // Track this ref as visited
      const newVisited = new Set(visitedRefs);
      newVisited.add(schema.$ref);
      return resolveSchema(apiDoc, resolved, newVisited, depth + 1);
    }
  }

  if (schema.properties) {
    const resolvedProps: Record<string, ApiSchema> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      resolvedProps[key] = resolveSchema(apiDoc, prop, visitedRefs, depth + 1);
    }
    return { ...schema, properties: resolvedProps };
  }

  if (schema.items) {
    return { ...schema, items: resolveSchema(apiDoc, schema.items, visitedRefs, depth + 1) };
  }

  return schema;
}
