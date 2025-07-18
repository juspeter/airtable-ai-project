# Personal Laptop Setup Guide

## 🎯 Goal
Set up complete Airtable automation environment on personal Windows laptop with Claude Code.

## 📋 Prerequisites
- Windows laptop with Claude Code installed
- Git installed
- Node.js 18+ installed

## 🚀 Quick Setup (5 minutes)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/airtable-automation.git
cd airtable-automation
```

### 2. Install Dependencies
```bash
npm install
npx playwright install
```

### 3. Configure Environment
```bash
# Copy and edit environment file
cp .env.template .env
# Edit .env file - change DEVICE_NAME to "personal-laptop"
```

### 4. Test Setup
```bash
npm test
node test-connection.js
```

## 📁 Project Overview

### **Core Directories:**
- `automation/` - Browser automation for Airtable interfaces
- `migration/` - Accelerated 2-3 week migration tools  
- `analysis/` - Google Sheets to Airtable conversion
- `interfaces/` - Automated interface builders
- `reporting/` - PDF generation and documentation
- `sync/` - Cross-device Git workflows

### **Key Files:**
- `ACCELERATED_MIGRATION_PLAN.md` - Complete 2-3 week roadmap
- `automation/airtable-browser.js` - Browser automation class
- `migration/shadow-table-creator.js` - Creates optimized tables
- `.env` - Configuration (customize for personal laptop)

## 🏗️ Migration Context

### **Current Situation:**
- **16 complex tables** in Airtable Release Base
- **98 fields** in overcomplicated Builds table
- **Multiple Google Sheets** needing migration
- **Performance issues** and sync complexity

### **Target Architecture:**
- **7 streamlined tables** (75% reduction)
- **Unified JIRA table** (consolidates 4 tables)
- **Google Sheets → Tasks table** migration
- **60% field reduction** in main tables

### **Accelerated Timeline:**
- **Week 1:** Shadow tables + sync setup
- **Week 2:** Data migration + interface building
- **Week 3:** Cutover + optimization

## 🤖 Browser Automation Guide

### **Running Automation:**
```bash
# Visible mode (watch it work)
HEADLESS_MODE=false node automation/airtable-browser.js

# Headless mode (run in background)  
HEADLESS_MODE=true node automation/create-interfaces.js
```

### **Key Capabilities:**
- **Interface Designer automation** - builds dashboards/forms automatically
- **Table creation** - creates optimized shadow tables
- **Data migration** - safely moves data between tables
- **Screenshot documentation** - captures all steps
- **Error recovery** - handles failures gracefully

## 📊 Critical Data Context

### **Airtable Base Details:**
- **Base ID:** `appB6mYCLrK1VkGLg` 
- **API Key:** In .env file (enterprise permissions)
- **Main Tables:** Builds, Integrations, Hotfixes, ShitHappens, RQA

### **Sync Dependencies:**
- **JIRA syncs:** REAL, ERM, SHI projects (10K record limit)
- **Airtable syncs:** Build Milestones, Scheduled Deploys, Build Phases
- **External integrations:** Workato recipes for Grafana/JIRA

### **Google Sheets to Migrate:**
- Master Release Checklist V5 → Tasks table
- Release Team Support → Tasks table  
- Vendor Certification Tracker → Tasks table

## 🔧 Personal Laptop Specific Setup

### **Environment Configuration:**
```bash
# In .env file, set:
DEVICE_NAME=personal-laptop
HEADLESS_MODE=false  # See automation in action
DEBUG=true
SCREENSHOT_PATH=./automation/screenshots
```

### **Recommended Workflow:**
1. **Morning:** Pull latest changes from work laptop
2. **Run automation:** Dedicated focus, no multitasking needed
3. **Evening:** Commit and push changes back

### **Git Sync Strategy:**
```bash
# Daily routine
git pull origin main
# Work on automation
git add .
git commit -m "Personal laptop automation work"
git push origin main
```

## 🎯 Next Steps After Setup

### **Immediate Tasks:**
1. Test browser automation with simple interface creation
2. Create first shadow table (start with Reports table)
3. Migrate one Google Sheet to Tasks table
4. Build Version Report v2 interface

### **Development Priority:**
1. **Shadow table creation** - safest place to start
2. **Interface automation** - high impact, visible results
3. **Data migration** - preserve all existing data
4. **Performance optimization** - measure improvements

## 🆘 Troubleshooting

### **Common Issues:**
- **Playwright install fails:** Run `npx playwright install --with-deps`
- **Airtable connection fails:** Check API key in .env file
- **Browser automation stuck:** Check for popup blockers/2FA
- **Git sync conflicts:** Use `git stash` before pulling

### **Support Resources:**
- Migration plan: `ACCELERATED_MIGRATION_PLAN.md`
- Browser automation: `automation/airtable-browser.js`
- Error logs: Check console output and screenshots

## 💡 Claude Code Tips

### **For Claude Code on Personal Laptop:**
- Use this README as context for any questions
- Reference `ACCELERATED_MIGRATION_PLAN.md` for migration details
- Check `automation/screenshots/` for visual progress
- Look at `.env` file for current configuration

### **Key Commands:**
```bash
# Start automation session
npm run dev

# Run migration tools
npm run migrate

# Generate reports
npm run generate-report

# Cross-device sync
npm run sync
```

This setup gives you complete Airtable automation capabilities on your personal laptop with full context for Claude Code assistance.