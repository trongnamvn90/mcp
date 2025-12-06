/**
 * API Docs management tools
 * - Add/Remove/List API documentation
 * - Adding an API doc also whitelists its baseURL
 */

import { z } from 'zod';
import { getStorage } from '../utils/storage.js';
import {
  parseOpenAPIFromUrl,
  parseOpenAPIContent,
  extractApiDoc,
} from '../utils/openapi-parser.js';
import type { ApiDoc } from '../types/index.js';

// Schemas for tool parameters
export const addApiDocSchema = z.object({
  id: z
    .string()
    .describe('Unique identifier for the API doc (e.g., "petstore", "github")'),
  name: z.string().describe('Display name for the API'),
  specUrl: z
    .string()
    .url()
    .optional()
    .describe('URL to OpenAPI/Swagger spec (JSON or YAML)'),
  specContent: z
    .string()
    .optional()
    .describe('OpenAPI/Swagger spec content as string (if not using URL)'),
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe('Override base URL (auto-detected from spec if not provided)'),
  apiHashUrl: z
    .string()
    .url()
    .optional()
    .describe('URL that returns a hash/version string to check for updates'),
});

export const removeApiDocSchema = z.object({
  id: z.string().describe('ID of the API doc to remove'),
});

export const listApiDocsSchema = z.object({
  verbose: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include endpoint count and other details'),
});

export const getApiDocSchema = z.object({
  id: z.string().describe('ID of the API doc to get details for'),
  includeEndpoints: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full endpoint list'),
  includeSchemas: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include schema definitions'),
});

export const refreshApiDocSchema = z.object({
  id: z.string().describe('ID of the API doc to refresh from its spec URL'),
});

// Tool implementations
export async function addApiDoc(
  params: z.infer<typeof addApiDocSchema>
): Promise<{ success: boolean; apiDoc?: Partial<ApiDoc>; error?: string }> {
  try {
    const storage = await getStorage();

    // Check if ID already exists
    const existing = await storage.getApiDoc(params.id);
    if (existing) {
      return { success: false, error: `API doc '${params.id}' already exists` };
    }

    let apiDoc: ApiDoc;

    if (params.specUrl) {
      // Fetch and parse from URL
      const { spec } = await parseOpenAPIFromUrl(params.specUrl);
      apiDoc = extractApiDoc(spec, params.id, params.name, params.specUrl);
    } else if (params.specContent) {
      // Parse from content
      const spec = parseOpenAPIContent(params.specContent);
      apiDoc = extractApiDoc(spec, params.id, params.name);
    } else {
      return {
        success: false,
        error: 'Either specUrl or specContent must be provided',
      };
    }

    // Override baseUrl if provided
    if (params.baseUrl) {
      apiDoc.baseUrl = params.baseUrl;
    }

    // Save hash URL if provided
    if (params.apiHashUrl) {
      apiDoc.apiHashUrl = params.apiHashUrl;
    }

    if (!apiDoc.baseUrl) {
      return {
        success: false,
        error: 'Could not determine baseUrl. Please provide it explicitly.',
      };
    }

    await storage.addApiDoc(apiDoc);

    return {
      success: true,
      apiDoc: {
        id: apiDoc.id,
        name: apiDoc.name,
        baseUrl: apiDoc.baseUrl,
        version: apiDoc.version,
        description: apiDoc.description,
        endpointCount: apiDoc.endpoints.length,
      } as Partial<ApiDoc> & { endpointCount: number },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function removeApiDoc(
  params: z.infer<typeof removeApiDocSchema>
): Promise<{ success: boolean; message: string }> {
  try {
    const storage = await getStorage();
    const removed = await storage.removeApiDoc(params.id);

    if (removed) {
      return {
        success: true,
        message: `API doc '${params.id}' removed successfully. Its baseURL is no longer whitelisted.`,
      };
    } else {
      return { success: false, message: `API doc '${params.id}' not found` };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listApiDocs(
  params: z.infer<typeof listApiDocsSchema>
): Promise<{
  apiDocs: Array<{
    id: string;
    name: string;
    baseUrl: string;
    version?: string;
    endpointCount?: number;
    addedAt?: string;
  }>;
  whitelistedUrls: string[];
}> {
  const storage = await getStorage();
  const apiDocs = await storage.getApiDocs();

  const result = apiDocs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    baseUrl: doc.baseUrl,
    ...(params.verbose && {
      version: doc.version,
      endpointCount: doc.endpoints.length,
      addedAt: doc.addedAt,
    }),
  }));

  return {
    apiDocs: result,
    whitelistedUrls: storage.getWhitelistedBaseUrls(),
  };
}

export async function getApiDocDetails(
  params: z.infer<typeof getApiDocSchema>
): Promise<{
  success: boolean;
  apiDoc?: Partial<ApiDoc> & {
    endpointCount: number;
    tags: string[];
    securitySchemeNames: string[];
  };
  error?: string;
}> {
  try {
    const storage = await getStorage();
    const apiDoc = await storage.getApiDoc(params.id);

    if (!apiDoc) {
      return { success: false, error: `API doc '${params.id}' not found` };
    }

    // Extract unique tags
    const tags = [
      ...new Set(apiDoc.endpoints.flatMap((ep) => ep.tags || [])),
    ];

    const result: Partial<ApiDoc> & {
      endpointCount: number;
      tags: string[];
      securitySchemeNames: string[];
    } = {
      id: apiDoc.id,
      name: apiDoc.name,
      baseUrl: apiDoc.baseUrl,
      specUrl: apiDoc.specUrl,
      version: apiDoc.version,
      description: apiDoc.description,
      endpointCount: apiDoc.endpoints.length,
      tags,
      securitySchemeNames: Object.keys(apiDoc.securitySchemes || {}),
      addedAt: apiDoc.addedAt,
      updatedAt: apiDoc.updatedAt,
    };

    if (params.includeEndpoints) {
      result.endpoints = apiDoc.endpoints;
    }

    if (params.includeSchemas) {
      result.schemas = apiDoc.schemas;
    }

    return { success: true, apiDoc: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function refreshApiDoc(
  params: z.infer<typeof refreshApiDocSchema>
): Promise<{ success: boolean; message: string; endpointCount?: number }> {
  try {
    const storage = await getStorage();
    const existing = await storage.getApiDoc(params.id);

    if (!existing) {
      return { success: false, message: `API doc '${params.id}' not found` };
    }

    if (!existing.specUrl) {
      return {
        success: false,
        message: `API doc '${params.id}' has no specUrl to refresh from`,
      };
    }

    const { spec } = await parseOpenAPIFromUrl(existing.specUrl);
    const updated = extractApiDoc(
      spec,
      existing.id,
      existing.name,
      existing.specUrl
    );

    // Keep the original baseUrl if it was overridden
    updated.baseUrl = existing.baseUrl;
    updated.addedAt = existing.addedAt;

    await storage.updateApiDoc(params.id, updated);

    return {
      success: true,
      message: `API doc '${params.id}' refreshed successfully`,
      endpointCount: updated.endpoints.length,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
