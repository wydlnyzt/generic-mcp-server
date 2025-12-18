# MCP-TS

An MCP (Model Context Protocol) server architecture developed using TypeScript. This project provides an extensible framework for building and managing MCP tools, enabling AI applications to interact with external tools and services through a standardized protocol.

## Project Overview

MCP-TS is a modular MCP server implementation with the following features:

- 🔧 **Extensible Tool System**: Plugin-based architecture for easy tool addition
- 📝 **TypeScript Support**: Complete type safety and development experience
- 🚀 **Easy to Use**: Clean project structure and simple APIs
- 🔍 **Built-in Examples**: Includes user search tool example
- 📦 **Standardized Protocol**: Fully compatible with MCP standards

## Project Structure

```
mcp-ts/
├── src/
│   ├── index.ts          # Entry point
│   ├── server.ts         # MCP server core logic
│   ├── tool-base.ts      # Tool base class definition
│   ├── tool-manager.ts   # Tool manager
│   ├── tools/
│   │   └── sample-tool.ts # Sample tool: user search
│   └── utils/
│       └── api-client.ts # API client utility
├── package.json          # Project configuration and dependencies
├── tsconfig.json         # TypeScript configuration
├── LICENSE               # License file
└── README.md             # Project documentation
```

## Getting Started

### Requirements

- Node.js 16+ 
- pnpm

### Install Dependencies

```bash
pnpm install
```

### Build and Run

```bash
# Build project
pnpm run build

# Start the server
pnpm start
```

### Test Server

Use MCP Inspector to test the server:

```bash
pnpm run inspector
```

This will start an interactive inspector where you can test the tool functionality.

## Development Guide

### Creating New Tools

1. Create a new tool file in the `src/tools/` directory
2. Extend the `ToolBase` class and implement the required methods

```typescript
import z from 'zod'
import { ToolBase } from '../tool-base'

export class YourCustomTool extends ToolBase {
    constructor() {
        super('your-tool-name', 'Tool description')
        this.schema = z.object({
            // Define tool parameter schema
            param1: z.string().describe('Parameter description'),
            param2: z.number().optional().describe('Optional parameter'),
        })
    }

    execute(args?: z.infer<typeof this.schema>): string {
        // Implement tool core logic
        const { param1, param2 } = args || {}
        
        // Processing logic...
        
        return JSON.stringify(result)
    }
}
```

3. Register the new tool in `tool-manager.ts`:

```typescript
static initialize(): void {
    [
        new SearchUserTool(),
        new YourCustomTool(),  // Add new tool
    ].forEach((tool) => this.registerTool(tool))
}
```

## Configuring MCP in Desktop Applications

### Claude Desktop Configuration

1. First, build the project:
```bash
pnpm run build
```

2. Locate the Claude Desktop configuration file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

3. Add MCP server configuration to the config file:

```json
{
  "mcpServers": {
    "mcp-ts": {
      "command": "node",
      "args": ["/path/to/your/mcp-ts/dist/index.js"],
      "env": {
        "SERVER_NAME": "MCP-TS Server"
      }
    }
  }
}
```

4. Restart Claude Desktop application

### Other Desktop Application Configuration

For other MCP-compatible desktop applications, you typically need to:

1. Specify executable file path: `/path/to/mcp-ts/dist/index.js`
2. Set runtime environment: Node.js  
3. Configure environment variables (optional):
   - `SERVER_NAME`: Server name
   - You can also use `pnpm start` command after building the project

### Verify Configuration

After configuration, you should be able to see the following tools in the desktop application:

- `wydln-get-user`: User information search tool

## Available Scripts

- `pnpm start`: Start the MCP server (requires build first)
- `pnpm run build`: Build project to `dist/` directory
- `pnpm run inspector`: Build and start MCP Inspector for debugging and testing

### Dependencies

#### Core Dependencies
- `@modelcontextprotocol/sdk` (^1.12.3): Official SDK for MCP protocol
- `zod` (^4.2.1): Runtime type validation and schema definition

#### Development Dependencies
- `typescript` (^5.8.3): TypeScript compiler
- `@types/node` (^24.0.3): Node.js type definitions

## License

This project is licensed under the **ISC License**.

The ISC License is a concise open source license that allows you to:

- ✅ Commercial use
- ✅ Distribution
- ✅ Modification
- ✅ Private use

The only requirement is to include the original copyright notice and license notice in all copies.

For detailed license terms, please see the [LICENSE](./LICENSE) file.

---

*If you find this project helpful, please give it a ⭐️!*
