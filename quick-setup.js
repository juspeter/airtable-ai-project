#!/usr/bin/env node
/**
 * Quick Setup for Airtable Automation
 * Installs core dependencies and creates basic structure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Quick Setup for Airtable Automation...\n');

// Create minimal package.json
const minimalPackage = {
    "name": "airtable-automation-suite",
    "version": "1.0.0", 
    "description": "AI-powered Airtable automation",
    "main": "index.js",
    "scripts": {
        "test": "echo \"Testing environment...\" && node -e \"console.log('✅ Node.js:', process.version)\"",
        "migrate": "node migration/run-migration.js",
        "analyze": "node analysis/analyze-sheets.js"
    },
    "dependencies": {
        "airtable": "^0.12.2",
        "playwright": "^1.40.1",
        "dotenv": "^16.3.1",
        "axios": "^1.6.5"
    }
};

fs.writeFileSync('package.json', JSON.stringify(minimalPackage, null, 2));
console.log('✅ Created minimal package.json');

// Install core dependencies
console.log('📦 Installing core dependencies...');
try {
    execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });
    console.log('✅ Core dependencies installed\n');
} catch (error) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
}

// Copy environment file
const envContent = `# Airtable Configuration
AIRTABLE_API_KEY=patxthccvf8JoEL7z.4e2272f42f272577411e0ccca5f22c3d11d3a7ecdf38f4f8dfac013a944e53df
AIRTABLE_BASE_ID=appB6mYCLrK1VkGLg

# Project Configuration  
PROJECT_NAME=Airtable-Automation
DEVICE_NAME=work-laptop

# Browser Automation
HEADLESS_MODE=false
BROWSER_TIMEOUT=30000

# Development
DEBUG=true
LOG_LEVEL=info
`;

fs.writeFileSync('.env', envContent);
console.log('✅ Created .env file');

// Create essential directories
const dirs = [
    'automation',
    'migration', 
    'analysis',
    'interfaces',
    'reporting',
    'sync',
    'templates'
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created: ${dir}/`);
    }
});

// Create test script
const testScript = `require('dotenv').config();
const Airtable = require('airtable');

console.log('🧪 Testing Airtable connection...');

const base = new Airtable({ 
    apiKey: process.env.AIRTABLE_API_KEY 
}).base(process.env.AIRTABLE_BASE_ID);

base('Builds').select({ maxRecords: 1 }).firstPage()
    .then(records => {
        console.log('✅ Airtable connection successful!');
        console.log(\`📊 Found \${records.length} test record(s)\`);
        if (records.length > 0) {
            console.log(\`📋 Sample record ID: \${records[0].id}\`);
        }
    })
    .catch(error => {
        console.error('❌ Airtable connection failed:', error.message);
    });
`;

fs.writeFileSync('test-connection.js', testScript);
console.log('✅ Created test-connection.js');

console.log('\n🎉 Quick setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Run: node test-connection.js');
console.log('2. Review .env file settings');
console.log('3. Start building your automation workflows');

console.log('\n📁 Project structure:');
dirs.forEach(dir => console.log(`  - ${dir}/`));

module.exports = { success: true };