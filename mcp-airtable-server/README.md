# MCP Airtable Enhanced Server

An MCP server that provides enhanced Airtable control through both API and browser automation.

## Features

- **API Operations**: Fast operations using Airtable API
- **Browser Automation**: Create interfaces, set up automations, and perform UI-only tasks
- **Hybrid Approach**: Best of both worlds - speed where possible, capability where needed

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Claude Code to use this MCP server by adding to your settings:
```json
{
  "mcpServers": {
    "airtable-enhanced": {
      "command": "node",
      "args": ["C:/Users/justi/Documents/airtable-ai-project/mcp-airtable-server/src/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "your-api-key",
        "AIRTABLE_BASE_ID": "your-base-id"
      }
    }
  }
}
```

## Available Tools

### API-Based Tools
- `analyzeBase` - Analyze base structure
- `createField` - Create new fields (requires browser)
- `createView` - Create filtered views

### Browser Automation Tools
- `loginToAirtable` - Open browser and login
- `createInterface` - Create interface pages
- `setupAutomation` - Configure automations

## Usage

1. First, login to Airtable:
```
loginToAirtable({ headless: false })
```

2. Complete SSO login in the browser

3. Use other tools to automate Airtable:
```
createInterface({ 
  interfaceName: "Release Dashboard",
  layout: "dashboard"
})
```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Future Enhancements

- [ ] Complete interface element library
- [ ] Automation template system
- [ ] Field formula builder
- [ ] View configuration templates
- [ ] Batch operations support