# MCP Servers Collection

A collection of Model Context Protocol (MCP) servers for Claude Code and AI CLI tools.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is an open protocol that allows applications to provide context for LLMs in a standardized way.

## Available Servers

| Server | Description | Status |
|--------|-------------|--------|
| [api-scout](./api-scout) | API testing with OpenAPI docs, credentials, and authenticated calls | Ready |

## Quick Start

### api-scout

```bash
cd api-scout
npm install
npm run build
```

Add to Claude Code config (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "api-scout": {
      "command": "node",
      "args": ["/absolute/path/to/api-scout/dist/index.js"]
    }
  }
}
```

## Usage Example

```
# Add an API documentation (this whitelists the baseURL)
add_api_doc(id="github", name="GitHub API", specUrl="...")

# Search for endpoints
search_endpoints(query="repos")

# Add credentials
add_credential(id="github-token", name="GitHub Token", type="bearer", token="ghp_xxx")

# Call the API
call_api(apiDocId="github", path="/repos/{owner}/{repo}", method="GET",
         pathParams={"owner": "anthropics", "repo": "claude-code"},
         credentialId="github-token")
```

## Development

See [CLAUDE.md](./CLAUDE.md) for development guidelines.

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## License

MIT
