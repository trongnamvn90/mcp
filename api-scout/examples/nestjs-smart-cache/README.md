# NestJS Smart Cache Demo

This example demonstrates how to configure a NestJS application to support **API Scout's Smart Caching** feature.

## Prerequisite

You need to have `api-scout` installed and running in your MCP client (e.g., Claude Desktop).

## Setup & Run

1.  Navigate to this directory:
    ```bash
    cd examples/nestjs-smart-cache
    ```

2.  Install dependencies (Minimal set for this demo):
    ```bash
    npm install @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/swagger rxjs reflect-metadata class-validator class-transformer
    ```

3.  Run the server:
    ```bash
    npx ts-node src/main.ts
    ```

4.  The server will start at `http://localhost:3000`.

## Connecting to API Scout

In Claude Desktop, use the `add_api_doc` tool:

```json
{
  "id": "demo-cats",
  "name": "Cats Demo API",
  "specUrl": "http://localhost:3000/api/docs-json",
  "apiHashUrl": "http://localhost:3000/api/docs-hash"
}
```

## Testing Smart Cache

1.  Ask API Scout: "List all endpoints in demo-cats".
2.  Stop the server.
3.  Modify `src/main.ts` (e.g., add a new `@Get('food')` method to `CatsController`).
4.  Restart the server.
5.  Ask API Scout: "List all endpoints" **AGAIN**.
    *   API Scout will automatically detect the hash change via `http://localhost:3000/api/docs-hash`.
    *   It will re-fetch the docs.
    *   You will see your new `food` endpoint immediately! 🚀
