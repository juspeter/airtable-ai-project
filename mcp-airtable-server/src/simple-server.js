#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import Airtable from 'airtable';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

class SimpleAirtableServer {
  constructor() {
    this.server = new Server(
      {
        name: 'airtable-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize Airtable
    this.airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
    this.base = this.airtable.base(process.env.AIRTABLE_BASE_ID);

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_tables',
            description: 'List all tables in the Airtable base (requires manual input of table names)',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'analyze_table',
            description: 'Analyze the structure of a specific table',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Name of the table to analyze',
                },
              },
              required: ['tableName'],
            },
          },
          {
            name: 'get_records',
            description: 'Get records from a table with optional filtering',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Name of the table',
                },
                maxRecords: {
                  type: 'number',
                  description: 'Maximum number of records to return',
                  default: 10,
                },
                view: {
                  type: 'string',
                  description: 'Name of the view to use (optional)',
                },
              },
              required: ['tableName'],
            },
          },
          {
            name: 'create_record',
            description: 'Create a new record in a table',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Name of the table',
                },
                fields: {
                  type: 'object',
                  description: 'Fields and values for the new record',
                },
              },
              required: ['tableName', 'fields'],
            },
          },
        ],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'list_tables':
          return await this.listTables();
        case 'analyze_table':
          return await this.analyzeTable(request.params.arguments);
        case 'get_records':
          return await this.getRecords(request.params.arguments);
        case 'create_record':
          return await this.createRecord(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async listTables() {
    try {
      return {
        content: [
          {
            type: 'text',
            text: `Connected to Airtable Base: ${process.env.AIRTABLE_BASE_ID}

Note: The Airtable API doesn't provide a direct way to list tables.
To analyze your base structure, use the 'analyze_table' tool with known table names.

Common table names to try:
- Releases
- Tasks  
- Issues
- Milestones
- Teams
- Deploy Tracker

Use: analyze_table with tableName parameter to explore each table.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
      };
    }
  }

  async analyzeTable({ tableName }) {
    try {
      const table = this.base(tableName);
      
      // Get first few records to understand structure
      const records = await table.select({ maxRecords: 3 }).firstPage();
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Table "${tableName}" exists but contains no records.`,
            },
          ],
        };
      }

      // Analyze field structure
      const sampleRecord = records[0];
      const fields = Object.keys(sampleRecord.fields);
      
      const analysis = {
        tableName,
        recordCount: `${records.length} sample records analyzed`,
        fields: fields,
        sampleData: records.map(record => ({
          id: record.id,
          fields: record.fields
        }))
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing table "${tableName}": ${error.message}
            
Possible reasons:
- Table name doesn't exist
- No permission to access table
- Table is empty

Try checking the exact table name in your Airtable base.`,
          },
        ],
      };
    }
  }

  async getRecords({ tableName, maxRecords = 10, view }) {
    try {
      const table = this.base(tableName);
      const options = { maxRecords };
      if (view) options.view = view;

      const records = await table.select(options).firstPage();
      
      const result = {
        tableName,
        recordCount: records.length,
        records: records.map(record => ({
          id: record.id,
          fields: record.fields,
          createdTime: record.get('Created')
        }))
      };

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
        content: [{ type: 'text', text: `Error getting records: ${error.message}` }],
      };
    }
  }

  async createRecord({ tableName, fields }) {
    try {
      const table = this.base(tableName);
      const record = await table.create([{ fields }]);
      
      return {
        content: [
          {
            type: 'text',
            text: `Record created successfully in "${tableName}":
${JSON.stringify({
  id: record[0].getId(),
  fields: record[0].fields
}, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error creating record: ${error.message}` }],
      };
    }
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Simple Airtable MCP server running on stdio');
  }
}

const server = new SimpleAirtableServer();
server.run().catch(console.error);