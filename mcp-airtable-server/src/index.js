import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Airtable from 'airtable';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AirtableBrowserTools } from './browser-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

class AirtableEnhancedServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-airtable-enhanced',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
    this.baseId = process.env.AIRTABLE_BASE_ID;
    this.browserTools = new AirtableBrowserTools(this.baseId);

    this.setupTools();
    this.setupErrorHandling();
  }

  setupTools() {
    // API-based tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'analyzeBase',
          description: 'Analyze Airtable base structure including tables, fields, and views',
          inputSchema: {
            type: 'object',
            properties: {
              includeViews: {
                type: 'boolean',
                description: 'Include view details in analysis',
                default: true,
              },
            },
          },
        },
        {
          name: 'createField',
          description: 'Create a new field in an Airtable table',
          inputSchema: {
            type: 'object',
            properties: {
              tableName: { type: 'string', description: 'Name of the table' },
              fieldName: { type: 'string', description: 'Name of the new field' },
              fieldType: { 
                type: 'string', 
                description: 'Field type (singleLineText, multilineText, number, formula, etc.)' 
              },
              options: { 
                type: 'object', 
                description: 'Field-specific options (e.g., formula for formula fields)' 
              },
            },
            required: ['tableName', 'fieldName', 'fieldType'],
          },
        },
        {
          name: 'createView',
          description: 'Create a new view in an Airtable table',
          inputSchema: {
            type: 'object',
            properties: {
              tableName: { type: 'string', description: 'Name of the table' },
              viewName: { type: 'string', description: 'Name of the new view' },
              viewType: { 
                type: 'string', 
                description: 'View type (grid, calendar, kanban, gallery, form)',
                default: 'grid'
              },
              filters: { type: 'array', description: 'Array of filter conditions' },
              sorts: { type: 'array', description: 'Array of sort conditions' },
            },
            required: ['tableName', 'viewName'],
          },
        },
        {
          name: 'createInterface',
          description: 'Create a new interface page using browser automation',
          inputSchema: {
            type: 'object',
            properties: {
              interfaceName: { type: 'string', description: 'Name of the interface' },
              layout: { 
                type: 'string', 
                description: 'Layout type (dashboard, record-review, etc.)' 
              },
              elements: { 
                type: 'array', 
                description: 'Array of interface elements to add' 
              },
            },
            required: ['interfaceName'],
          },
        },
        {
          name: 'setupAutomation',
          description: 'Set up an Airtable automation using browser automation',
          inputSchema: {
            type: 'object',
            properties: {
              automationName: { type: 'string', description: 'Name of the automation' },
              trigger: { 
                type: 'object', 
                description: 'Trigger configuration (type, table, conditions)' 
              },
              actions: { 
                type: 'array', 
                description: 'Array of actions to perform' 
              },
            },
            required: ['automationName', 'trigger', 'actions'],
          },
        },
        {
          name: 'loginToAirtable',
          description: 'Login to Airtable using browser automation (required before UI operations)',
          inputSchema: {
            type: 'object',
            properties: {
              headless: { 
                type: 'boolean', 
                description: 'Run browser in headless mode',
                default: false 
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'analyzeBase':
          return await this.analyzeBase(args);
        case 'createField':
          return await this.createField(args);
        case 'createView':
          return await this.createView(args);
        case 'createInterface':
          return await this.createInterface(args);
        case 'setupAutomation':
          return await this.setupAutomation(args);
        case 'loginToAirtable':
          return await this.loginToAirtable(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async analyzeBase({ includeViews = true }) {
    try {
      // If browser is available, use it to discover tables
      if (this.browserTools.browser) {
        const tables = await this.browserTools.discoverTables();
        
        // Now we can use the API to get detailed info about each table
        const base = this.airtable.base(this.baseId);
        const tableDetails = [];
        
        for (const table of tables) {
          try {
            // Get records to analyze field structure
            const records = await base(table.name).select({ maxRecords: 1 }).firstPage();
            const fields = records.length > 0 ? Object.keys(records[0].fields) : [];
            
            tableDetails.push({
              name: table.name,
              id: table.id,
              fields: fields,
              recordCount: 'Use API to count'
            });
          } catch (err) {
            tableDetails.push({
              name: table.name,
              id: table.id,
              error: err.message
            });
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                baseId: this.baseId,
                tables: tableDetails,
                totalTables: tables.length,
              }, null, 2),
            },
          ],
        };
      } else {
        // No browser, provide instructions
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                baseId: this.baseId,
                message: 'Base analysis requires browser access to discover tables.',
                nextStep: 'Use loginToAirtable first, then run analyzeBase again',
              }, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing base: ${error.message}`,
          },
        ],
      };
    }
  }

  async createField({ tableName, fieldName, fieldType, options = {} }) {
    try {
      if (!this.browserTools.browser) {
        return {
          content: [
            {
              type: 'text',
              text: 'Please login to Airtable first using the loginToAirtable tool.',
            },
          ],
        };
      }

      const result = await this.browserTools.createFieldWithUI(tableName, fieldName, fieldType, options);

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
            text: `Error creating field: ${error.message}`,
          },
        ],
      };
    }
  }

  async loginToAirtable({ headless = false }) {
    try {
      await this.browserTools.initialize(headless);
      const result = await this.browserTools.login();
      
      return {
        content: [
          {
            type: 'text',
            text: result.message + '\nPlease complete login if needed, then use analyzeBase to discover tables.',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error opening browser: ${error.message}`,
          },
        ],
      };
    }
  }

  async createInterface({ interfaceName, layout, elements }) {
    try {
      if (!this.browserTools.browser) {
        return {
          content: [
            {
              type: 'text',
              text: 'Please login to Airtable first using the loginToAirtable tool.',
            },
          ],
        };
      }

      const result = await this.browserTools.createInterface(interfaceName, { layout, elements });

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
            text: `Error creating interface: ${error.message}`,
          },
        ],
      };
    }
  }

  async setupAutomation({ automationName, trigger, actions }) {
    try {
      if (!this.browserTools.browser) {
        return {
          content: [
            {
              type: 'text',
              text: 'Please login to Airtable first using the loginToAirtable tool.',
            },
          ],
        };
      }

      const result = await this.browserTools.setupAutomation(automationName, trigger, actions);

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
            text: `Error setting up automation: ${error.message}`,
          },
        ],
      };
    }
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.browserTools.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Airtable Enhanced MCP server running');
  }
}

const server = new AirtableEnhancedServer();
server.run().catch(console.error);