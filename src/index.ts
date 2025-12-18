#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { ToolManager } from './tool-manager'

async function startServer(): Promise<void> {
    try {
        ToolManager.initialize()
        const server = new Server(
            {
                name: process.env.SERVER_NAME || 'generic-mcp-server',
                version: process.env.SERVER_VERSION || '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            },
        )

        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: ToolManager.getAllToolsDescription(),
            }
        })

        server.setRequestHandler(
            CallToolRequestSchema,
            async (request: any) => {
                const { name, arguments: args } = request.params
                try {
                    return await ToolManager.run(name, args)
                } catch (error) {
                    throw new Error(
                        `Failed to run tool ${name}: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    )
                }
            },
        )

        server.onerror = (error) => {
            console.error('Server error:', error)
        }

        const transport = new StdioServerTransport()
        await server.connect(transport)

        console.log(`Server started`)

        process.on('SIGINT', async () => {
            await server.close()
            process.exit(0)
        })

        process.on('SIGTERM', async () => {
            await server.close()
            process.exit(0)
        })
    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}

startServer().catch((error) => {
    console.error('Failed to start server:', error)
    process.exit(1)
})
