# Airtable AI Project

A comprehensive tool for analyzing and converting Airtable bases using AI.

## 🚀 Quick Start

### 1. Setup API Credentials

Edit the `.env` file and add your credentials:

```
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_base_id_here
```

#### Getting Your Airtable API Key:
1. Go to [Airtable Account](https://airtable.com/account)
2. Click on "Generate API key" or use a Personal Access Token (recommended)
3. For Personal Access Token: Go to [https://airtable.com/create/tokens](https://airtable.com/create/tokens)
4. Create a token with these scopes:
   - `data.records:read` - Read records
   - `data.records:write` - Write records (if needed)
   - `schema.bases:read` - Read base schema

#### Getting Your Base ID:
1. Open your Airtable base
2. Look at the URL: `https://airtable.com/appXXXXXXXXXXXXXX/...`
3. The part starting with `app` is your Base ID

### 2. Test Connection

Run the base scanner to test your connection:

```bash
npm run scan
```

Or with specific table names:

```bash
node scripts/base-scanner.js "Table Name 1" "Table Name 2"
```

## 📁 Project Structure

```
Airtable-AI-Project/
├── scripts/           # Main scripts
│   └── base-scanner.js   # Scans Airtable base structure
├── analysis/          # Analysis results and reports
├── templates/         # Templates for conversions
├── documentation/     # Project documentation
├── .env              # API keys (not tracked in git)
├── .gitignore        # Git ignore file
├── package.json      # Node.js project file
└── README.md         # This file
```

## 🛠️ Available Scripts

- `npm run scan` - Run the base scanner
- `npm run analyze` - Run analysis (to be implemented)

## 🔒 Security

- Never commit your `.env` file
- API keys are stored locally and ignored by git
- All sensitive data in the `analysis/` folder is gitignored

## 📝 Next Steps

1. Add your Airtable credentials to `.env`
2. Run `npm run scan` to test the connection
3. Add your table names to the scanner script
4. Run the scanner with your tables
5. Check the `analysis/` folder for results

## 🤝 Contributing

This is a private project. Keep all API keys and sensitive data secure.