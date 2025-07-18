# MCP Airtable Server Setup Guide

## Prerequisites

1. Node.js installed (v18 or higher)
2. Your Airtable API key and Base ID
3. Claude Code desktop app

## Installation Steps

### 1. Install Dependencies

```bash
cd C:\Users\justi\Documents\airtable-ai-project\mcp-airtable-server
npm install
```

### 2. Configure Claude Code

Open Claude Code settings and add the MCP server configuration:

**Windows:**
```json
{
  "mcpServers": {
    "airtable-enhanced": {
      "command": "node",
      "args": ["C:\\Users\\justi\\Documents\\airtable-ai-project\\mcp-airtable-server\\src\\index.js"]
    }
  }
}
```

**Alternative: Using npm script:**
```json
{
  "mcpServers": {
    "airtable-enhanced": {
      "command": "npm",
      "args": ["run", "start"],
      "cwd": "C:\\Users\\justi\\Documents\\airtable-ai-project\\mcp-airtable-server"
    }
  }
}
```

### 3. Verify Environment Variables

Ensure your `.env` file in the parent directory contains:
```
AIRTABLE_API_KEY=your_api_key_here
AIRTABLE_BASE_ID=your_base_id_here
```

## Usage Examples

### 1. Initial Setup and Login

```
1. First, login to Airtable:
   loginToAirtable({ headless: false })

2. Complete SSO login in the browser window

3. Analyze your base structure:
   analyzeBase({ includeViews: true })
```

### 2. Create an Interface

```
createInterface({
  interfaceName: "Release Dashboard",
  layout: "dashboard"
})
```

### 3. Add Fields to Tables

```
createField({
  tableName: "Releases",
  fieldName: "Risk Score",
  fieldType: "formula",
  options: {
    formula: "IF({Incidents} > 5, 'High', IF({Incidents} > 2, 'Medium', 'Low'))"
  }
})
```

### 4. Setup Automations

```
setupAutomation({
  automationName: "High Risk Alert",
  trigger: {
    type: "record_matches_conditions",
    table: "Releases",
    conditions: [{
      field: "Risk Score",
      operator: "equals",
      value: "High"
    }]
  },
  actions: [{
    type: "send_email",
    recipient: "release-team@company.com",
    subject: "High Risk Release Alert",
    message: "A release has been flagged as high risk"
  }]
})
```

## Troubleshooting

### MCP Server Not Found
- Ensure the path in Claude Code settings is correct
- Try using forward slashes even on Windows
- Check that all dependencies are installed

### Browser Automation Issues
- Some operations require manual interaction (like SSO login)
- If selectors fail, the Airtable UI may have changed
- Try running with `headless: false` to see what's happening

### API Limitations
- Field creation requires browser automation
- Interface design is UI-only
- Some operations combine API + browser for best results

## Next Steps

1. Test the connection with a simple `analyzeBase` call
2. Build out your specific automation workflows
3. Create reusable templates for common operations
4. Consider deploying to your Synology NAS for always-on automation