#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create the MCP server
const server = new McpServer({
  name: "example-server",
  version: "0.1.0",
});

// Register a simple echo tool
server.tool(
  "echo",
  "Echoes back the input message",
  {
    message: z.string().describe("The message to echo back"),
  },
  async ({ message }) => {
    return {
      content: [
        {
          type: "text",
          text: `Echo: ${message}`,
        },
      ],
    };
  }
);

// Register a calculator tool
server.tool(
  "calculate",
  "Performs basic arithmetic operations",
  {
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("The arithmetic operation to perform"),
    a: z.number().describe("First operand"),
    b: z.number().describe("Second operand"),
  },
  async ({ operation, a, b }) => {
    let result: number;

    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Division by zero is not allowed",
              },
            ],
            isError: true,
          };
        }
        result = a / b;
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `${a} ${operation} ${b} = ${result}`,
        },
      ],
    };
  }
);

// Register a timestamp tool
server.tool(
  "get_timestamp",
  "Returns the current timestamp in various formats",
  {
    format: z
      .enum(["iso", "unix", "human"])
      .default("iso")
      .describe("The format for the timestamp"),
  },
  async ({ format }) => {
    const now = new Date();
    let timestamp: string;

    switch (format) {
      case "iso":
        timestamp = now.toISOString();
        break;
      case "unix":
        timestamp = Math.floor(now.getTime() / 1000).toString();
        break;
      case "human":
        timestamp = now.toLocaleString();
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `Current timestamp (${format}): ${timestamp}`,
        },
      ],
    };
  }
);

// Main function to start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();

  // Handle server close
  server.server.onclose = () => {
    process.exit(0);
  };

  await server.connect(transport);

  // Handle process signals
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error: Error) => {
  console.error("Server error:", error);
  process.exit(1);
});
