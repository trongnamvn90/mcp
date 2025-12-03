#!/usr/bin/env node
/**
 * API Testing MCP Server
 *
 * A Model Context Protocol server for API testing:
 * - Manage API documentation (OpenAPI/Swagger)
 * - Search and explore API endpoints
 * - Store credentials securely
 * - Make API calls against whitelisted URLs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getStorage } from './utils/storage.js';

// Import tool implementations
import {
  addApiDoc,
  addApiDocSchema,
  removeApiDoc,
  removeApiDocSchema,
  listApiDocs,
  listApiDocsSchema,
  getApiDocDetails,
  getApiDocSchema,
  refreshApiDoc,
  refreshApiDocSchema,
} from './tools/api-docs.js';

import {
  searchApiEndpoints,
  searchEndpointsSchema,
  getApiEndpointInfo,
  getEndpointInfoSchema,
  listApiEndpoints,
  listEndpointsSchema,
  listApiTags,
  listTagsSchema,
} from './tools/search.js';

import {
  addCredential,
  addCredentialSchema,
  updateCredential,
  updateCredentialSchema,
  removeCredential,
  removeCredentialSchema,
  listCredentials,
  listCredentialsSchema,
  getCredentialInfo,
  getCredentialSchema,
} from './tools/credentials.js';

import {
  callApi,
  callApiSchema,
  callRawApi,
  callRawApiSchema,
} from './tools/api-call.js';

// Tool definitions
const TOOLS = [
  // API Docs Management
  {
    name: 'add_api_doc',
    description:
      'Add an API documentation from OpenAPI/Swagger spec. This also whitelists the baseURL for API calls.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier for the API doc',
        },
        name: {
          type: 'string',
          description: 'Display name for the API',
        },
        specUrl: {
          type: 'string',
          description: 'URL to OpenAPI/Swagger spec (JSON or YAML)',
        },
        specContent: {
          type: 'string',
          description: 'OpenAPI/Swagger spec content (if not using URL)',
        },
        baseUrl: {
          type: 'string',
          description: 'Override base URL (auto-detected from spec if not provided)',
        },
      },
      required: ['id', 'name'],
    },
  },
  {
    name: 'remove_api_doc',
    description: 'Remove an API documentation and unwhitelist its baseURL',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the API doc to remove' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_api_docs',
    description: 'List all registered API documentations and their whitelisted URLs',
    inputSchema: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'Include endpoint count and details',
        },
      },
    },
  },
  {
    name: 'get_api_doc',
    description: 'Get detailed information about an API documentation',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the API doc' },
        includeEndpoints: {
          type: 'boolean',
          description: 'Include full endpoint list',
        },
        includeSchemas: {
          type: 'boolean',
          description: 'Include schema definitions',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'refresh_api_doc',
    description: 'Refresh an API doc from its original spec URL',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the API doc to refresh' },
      },
      required: ['id'],
    },
  },

  // Search and Info
  {
    name: 'search_endpoints',
    description:
      'Search for API endpoints across all docs by keyword in path, summary, description, or tags',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        apiDocId: {
          type: 'string',
          description: 'Limit search to specific API doc',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          description: 'Filter by HTTP method',
        },
        tag: {
          type: 'string',
          description: 'Filter by tag',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_endpoint_info',
    description:
      'Get detailed information about a specific API endpoint including parameters, request body, and responses',
    inputSchema: {
      type: 'object',
      properties: {
        apiDocId: { type: 'string', description: 'ID of the API doc' },
        path: { type: 'string', description: 'Endpoint path' },
        method: { type: 'string', description: 'HTTP method' },
        resolveSchemas: {
          type: 'boolean',
          description: 'Resolve $ref schema references (default: true)',
        },
      },
      required: ['apiDocId', 'path', 'method'],
    },
  },
  {
    name: 'list_endpoints',
    description: 'List all endpoints in an API doc with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        apiDocId: { type: 'string', description: 'ID of the API doc' },
        tag: { type: 'string', description: 'Filter by tag' },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          description: 'Filter by HTTP method',
        },
        limit: { type: 'number', description: 'Maximum results (default: 50)' },
        offset: { type: 'number', description: 'Offset for pagination' },
      },
      required: ['apiDocId'],
    },
  },
  {
    name: 'list_tags',
    description: 'List all tags in an API doc with endpoint counts',
    inputSchema: {
      type: 'object',
      properties: {
        apiDocId: { type: 'string', description: 'ID of the API doc' },
      },
      required: ['apiDocId'],
    },
  },

  // Credentials Management
  {
    name: 'add_credential',
    description: 'Add a new credential for API authentication',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique identifier' },
        name: { type: 'string', description: 'Display name' },
        type: {
          type: 'string',
          enum: ['apiKey', 'bearer', 'basic', 'oauth2', 'custom'],
          description: 'Authentication type',
        },
        apiDocId: { type: 'string', description: 'Associate with API doc' },
        apiKey: { type: 'string', description: 'API key (for apiKey type)' },
        apiKeyHeader: {
          type: 'string',
          description: 'Header name (default: X-API-Key)',
        },
        token: { type: 'string', description: 'Bearer token' },
        username: { type: 'string', description: 'Username (for basic)' },
        password: { type: 'string', description: 'Password (for basic)' },
        accessToken: { type: 'string', description: 'OAuth2 access token' },
        refreshToken: { type: 'string', description: 'OAuth2 refresh token' },
        clientId: { type: 'string', description: 'OAuth2 client ID' },
        clientSecret: { type: 'string', description: 'OAuth2 client secret' },
        tokenUrl: { type: 'string', description: 'OAuth2 token URL' },
        headers: {
          type: 'object',
          description: 'Custom headers (for custom type)',
        },
      },
      required: ['id', 'name', 'type'],
    },
  },
  {
    name: 'update_credential',
    description: 'Update an existing credential',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Credential ID' },
        name: { type: 'string', description: 'New name' },
        apiKey: { type: 'string', description: 'New API key' },
        token: { type: 'string', description: 'New token' },
        username: { type: 'string', description: 'New username' },
        password: { type: 'string', description: 'New password' },
        accessToken: { type: 'string', description: 'New access token' },
        refreshToken: { type: 'string', description: 'New refresh token' },
        headers: { type: 'object', description: 'New headers' },
      },
      required: ['id'],
    },
  },
  {
    name: 'remove_credential',
    description: 'Remove a credential',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Credential ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_credentials',
    description: 'List all credentials (sensitive data masked)',
    inputSchema: {
      type: 'object',
      properties: {
        apiDocId: { type: 'string', description: 'Filter by API doc' },
      },
    },
  },
  {
    name: 'get_credential',
    description: 'Get credential details (sensitive data masked)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Credential ID' },
      },
      required: ['id'],
    },
  },

  // API Calls
  {
    name: 'call_api',
    description:
      'Make an API call to a registered endpoint. URL must be whitelisted via add_api_doc.',
    inputSchema: {
      type: 'object',
      properties: {
        apiDocId: { type: 'string', description: 'API doc ID' },
        path: { type: 'string', description: 'Endpoint path' },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          description: 'HTTP method',
        },
        pathParams: {
          type: 'object',
          description: 'Path parameters (e.g., { "id": "123" })',
        },
        queryParams: { type: 'object', description: 'Query parameters' },
        headers: { type: 'object', description: 'Additional headers' },
        body: { description: 'Request body' },
        credentialId: { type: 'string', description: 'Credential ID to use' },
      },
      required: ['apiDocId', 'path', 'method'],
    },
  },
  {
    name: 'call_raw_api',
    description:
      'Make a raw API call to any whitelisted URL. Add API docs to whitelist URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL (must be whitelisted)' },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          description: 'HTTP method',
        },
        headers: { type: 'object', description: 'Request headers' },
        body: { description: 'Request body' },
        credentialId: { type: 'string', description: 'Credential ID' },
      },
      required: ['url', 'method'],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: 'api-testing',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize storage
await getStorage();

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // API Docs
      case 'add_api_doc':
        result = await addApiDoc(addApiDocSchema.parse(args));
        break;
      case 'remove_api_doc':
        result = await removeApiDoc(removeApiDocSchema.parse(args));
        break;
      case 'list_api_docs':
        result = await listApiDocs(listApiDocsSchema.parse(args || {}));
        break;
      case 'get_api_doc':
        result = await getApiDocDetails(getApiDocSchema.parse(args));
        break;
      case 'refresh_api_doc':
        result = await refreshApiDoc(refreshApiDocSchema.parse(args));
        break;

      // Search
      case 'search_endpoints':
        result = await searchApiEndpoints(searchEndpointsSchema.parse(args));
        break;
      case 'get_endpoint_info':
        result = await getApiEndpointInfo(getEndpointInfoSchema.parse(args));
        break;
      case 'list_endpoints':
        result = await listApiEndpoints(listEndpointsSchema.parse(args));
        break;
      case 'list_tags':
        result = await listApiTags(listTagsSchema.parse(args));
        break;

      // Credentials
      case 'add_credential':
        result = await addCredential(addCredentialSchema.parse(args));
        break;
      case 'update_credential':
        result = await updateCredential(updateCredentialSchema.parse(args));
        break;
      case 'remove_credential':
        result = await removeCredential(removeCredentialSchema.parse(args));
        break;
      case 'list_credentials':
        result = await listCredentials(listCredentialsSchema.parse(args || {}));
        break;
      case 'get_credential':
        result = await getCredentialInfo(getCredentialSchema.parse(args));
        break;

      // API Calls
      case 'call_api':
        result = await callApi(callApiSchema.parse(args));
        break;
      case 'call_raw_api':
        result = await callRawApi(callRawApiSchema.parse(args));
        break;

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('API Testing MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
