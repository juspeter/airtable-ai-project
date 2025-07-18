#!/usr/bin/env node
/**
 * Airtable Automation Setup Script
 * Installs dependencies and configures environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Airtable Automation Environment...\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`📋 Node.js version: ${nodeVersion}`);
if (parseInt(nodeVersion.split('.')[0].slice(1)) < 18) {
    console.error('❌ Node.js 18+ required. Please upgrade Node.js');
    process.exit(1);
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully\n');
} catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
}

// Install Playwright browsers
console.log('🎭 Installing Playwright browsers...');
try {
    execSync('npx playwright install', { stdio: 'inherit' });
    console.log('✅ Playwright browsers installed\n');
} catch (error) {
    console.error('❌ Failed to install Playwright browsers:', error.message);
    process.exit(1);
}

// Set up environment file
const envTemplate = path.join(__dirname, '../.env.template');
const envFile = path.join(__dirname, '../.env');

if (!fs.existsSync(envFile)) {
    console.log('⚙️  Creating .env file...');
    fs.copyFileSync(envTemplate, envFile);
    console.log('✅ .env file created from template\n');
} else {
    console.log('ℹ️  .env file already exists, skipping creation\n');
}

// Create required directories
const directories = [
    'automation/screenshots',
    'automation/temp',
    'analysis/input',
    'analysis/output', 
    'migration/backups',
    'migration/logs',
    'interfaces/generated',
    'reporting/output',
    'reporting/templates',
    'sync/cache',
    'templates/table-schemas',
    'templates/interface-layouts'
];

console.log('📁 Creating directory structure...');
directories.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`  ✅ Created: ${dir}`);
    }
});

// Create .gitignore
const gitignoreContent = `# Dependencies
node_modules/
package-lock.json

# Environment
.env

# Logs
*.log
logs/
migration/logs/

# Screenshots and temp files
automation/screenshots/
automation/temp/
analysis/output/
reporting/output/
sync/cache/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Backups
migration/backups/
`;

fs.writeFileSync(path.join(__dirname, '../.gitignore'), gitignoreContent);
console.log('✅ .gitignore created\n');

// Create README
const readmeContent = `# Airtable Automation Suite

AI-powered automation environment for Airtable management with browser automation, interface building, and cross-device sync.

## Quick Start

\`\`\`bash
# Install dependencies
npm run setup

# Copy and configure environment
cp .env.template .env
# Edit .env with your settings

# Run tests
npm test

# Start development
npm run dev
\`\`\`

## Project Structure

- \`automation/\` - Browser automation for Interface Designer
- \`analysis/\` - Google Sheets analysis tools
- \`migration/\` - Data conversion scripts
- \`interfaces/\` - Interface templates and builders
- \`reporting/\` - PDF generation and documentation
- \`sync/\` - Cross-device workflows
- \`templates/\` - Reusable components

## Scripts

- \`npm run migrate\` - Run data migration
- \`npm run analyze\` - Analyze Google Sheets
- \`npm run build-interface\` - Generate Airtable interfaces
- \`npm run generate-report\` - Create documentation reports
- \`npm run sync\` - Cross-device synchronization

## Environment Variables

See \`.env.template\` for all configuration options.
`;

fs.writeFileSync(path.join(__dirname, '../README.md'), readmeContent);
console.log('✅ README.md created\n');

console.log('🎉 Setup complete! Next steps:');
console.log('1. Review and customize .env file');
console.log('2. Run: npm test');
console.log('3. Run: npm run dev');
console.log('4. Start building your automation workflows!\n');

console.log('📚 Key files created:');
console.log('  - package.json (dependencies and scripts)');
console.log('  - .env (configuration - customize this!)');
console.log('  - .gitignore (version control)');
console.log('  - README.md (documentation)');
console.log('  - Complete directory structure');

module.exports = { success: true };