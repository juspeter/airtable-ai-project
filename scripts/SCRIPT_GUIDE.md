# 📂 Scripts Guide - What Each Script Does and How to Use Them

## Overview
This guide explains what each script does, which ones are improvements of existing scripts, and how to copy them into Airtable for testing. **You don't need to understand the code** - just follow the copy/paste instructions.

---

## 🔄 Status of Current Folder Scripts

### Scripts That Have Been **ENHANCED** (Improved Versions)

#### ✅ `enhanced-version-report.js` 
**What it does**: This is an **enhanced version** of your existing version report script
- **Builds on**: Your current `versionreport.js` script
- **New features added**:
  - Trend analysis across multiple versions
  - Configurable scoring weights for different factors
  - Alert generation for concerning patterns
  - Better formatting and insights
- **Use it for**: Getting more detailed insights from your current version report
- **Status**: ✅ Ready to test - this is an **additive enhancement**, won't break anything

#### ✅ `season-report.js`
**What it does**: Analyzes entire seasons (like S35) across all point releases
- **Builds on**: Your version report data structure
- **What it analyzes**: 
  - Full season performance (S35: 35.00, 35.10, 35.20, 35.30)
  - Season-wide trends and patterns
  - Cross-version comparisons within a season
- **Use it for**: Understanding how well entire seasons performed
- **Status**: ✅ Ready to test - completely new functionality

#### ✅ `component-team-report.js`
**What it does**: Deep-dive analysis of specific components like "BR - Quests"
- **Analyzes**: 
  - Component-specific incident patterns
  - Team performance for specific components
  - Hotfix and integration patterns by component
- **Use it for**: Understanding which components/teams need support
- **Status**: ✅ Ready to test - new functionality

#### ✅ `release-readiness-report.js`
**What it does**: Determines if a release is ready to go live
- **Checks**: 
  - Integration pipeline status
  - Open issues and blockers
  - QA verification status
  - Risk factors
- **Use it for**: Go/no-go decision making before releases
- **Status**: ✅ Ready to test - new functionality

---

## 🆕 Completely New Scripts (High Priority)

### Deploy Tracker Replacement Scripts

#### 🚀 `realtime-release-monitor.js` 
**What it does**: **Replaces your Deploy Tracker Google Sheet**
- **Real-time tracking of**:
  - Current deploy status with emoji indicators
  - Milestone progress tracking
  - Active hotfixes sorted by urgency
  - Work volume metrics
  - Integration pipeline status
- **Use it for**: Live monitoring during releases (replaces Google Sheet)
- **Status**: ✅ Ready to test - **This is your Deploy Tracker replacement**

#### 📊 `work-volume-report.js`
**What it does**: **Identifies teams missing milestones due to overload**
- **Combines data from**:
  - Number of deploys
  - Commit volume between milestones
  - RQA whitegloves assigned
  - Open issues data
- **Calculates**: Work intensity scores and milestone risk
- **Use it for**: Understanding why teams miss deadlines
- **Status**: ✅ Ready to test - **Addresses your milestone adherence problem**

### Analysis & Prevention Scripts

#### 🔥 `hotfix-velocity-report.js`
**What it does**: Analyzes how fast you respond to hotfixes
- **Tracks**:
  - Response times by urgency (ASAP, Today, Scheduled)
  - QA verification rates
  - Component-specific response patterns
- **Use it for**: Improving emergency response processes
- **Status**: ✅ Ready to test

#### 🔄 `integration-pipeline-report.js`
**What it does**: Analyzes your HL→PD→Cert→Live pipeline
- **Identifies**:
  - Bottlenecks in the pipeline
  - Team performance in pipeline progression
  - Conversion rates between stages
- **Use it for**: Optimizing the integration flow
- **Status**: ✅ Ready to test

#### 📅 `milestone-adherence-report.js`
**What it does**: **Analyzes teams consistently missing milestones**
- **Tracks**:
  - Which teams miss deadlines most often
  - Delay patterns across milestone types
  - Predictive analysis for upcoming risks
- **Use it for**: Identifying teams that need support
- **Status**: ✅ Ready to test - **Directly addresses milestone adherence issues**

#### 💥 `shithappens-analysis-report.js`
**What it does**: Comprehensive incident analysis and prevention
- **Analyzes**:
  - Component risk patterns from your ShitHappens data
  - Root cause analysis
  - Incident prevention opportunities
- **Use it for**: Reducing future incidents
- **Status**: ✅ Ready to test

---

## 📋 How to Test Each Script in Airtable

### Step 1: Basic Setup (Do This Once)
1. **Open your Airtable base**
2. **Add the Scripting extension**:
   - Click the "Extensions" button (puzzle piece icon)
   - Click "Add an extension"
   - Search for "Scripting" and install it
3. **Open the Scripting extension**

### Step 2: Create Base Configuration (Do This First)
1. **In Scripting extension, click "Create a new script"**
2. **Name it**: "Base Configuration"
3. **Copy and paste this code**:

```javascript
// Base Configuration - Run this first
const FIELDS = {
    BUILD_VERSION_UNIFIED: 'Build Version (Unified)',
    PRIORITY: 'Priority',
    URGENCY_CUSTOM_FIELD: 'Urgency',
    QA_STATE: 'QA State',
    HOTFIX_CREATED_FIELD: 'Created',
    HOTFIX_RESOLVED_FIELD: 'Resolved',
    HL_TO_PD_FLAG: 'HL to PD Flag',
    PD_TO_CERT_SUB_FLAG: 'PD to Cert Sub Flag',
    CERT_SUB_TO_LIVE_FLAG: 'Cert Sub to Live Flag',
    LIVE_PLUS_FLAG: 'Live+ Flag',
    INTEGRATION_AREA: 'Integration Area',
    INTEGRATION_PLATFORM: 'Integration Platform',
    INTEGRATION_FN_DOMAIN: 'Integration FN Domain',
    INTEGRATION_REQUESTOR: 'Integration Requestor',
    INTEGRATION_CREATED_FIELD: 'Created',
    INTEGRATION_RESOLVED_FIELD: 'Resolved',
    RQA_FIX_VERSION: 'Fix Version/s',
    RQA_LABELS: 'Labels',
    RQA_ASSIGNEE: 'Assignee',
    RQA_COMPONENTS: 'Component/s',
    RQA_CREATED_FIELD: 'Created',
    COMMITS_PRE_HL: 'Commits - Pre HL',
    COMMITS_HL_TO_PD: 'Commits - HL to PD',
    COMMITS_PD_TO_CERT: 'Commits - PD to Cert',
    COMMITS_CERT_TO_LIVE: 'Commits - Cert to Live',
    COMMITS_LIVE_PLUS: 'Commits - Live+',
    MS_HARD_LOCK: 'HL Date',
    MS_PENCILS_DOWN: 'PD Date', 
    MS_CERT: 'Cert Sub Date',
    MS_LIVE: 'Live Date',
    DEPLOY_CLASSIFICATION: 'Deploy Classification'
};

const CONFIG = {
    HOTFIX_QA_VERIFIED_TARGET_PERCENT: 80,
    INTEGRATION_PIPELINE_TARGET_DAYS: 14,
    MILESTONE_ADHERENCE_TARGET_PERCENT: 75
};

console.log("Base configuration loaded successfully!");
console.log("You can now run the individual report scripts.");

// Store for other scripts to use
globalThis.AIRTABLE_FIELDS = FIELDS;
globalThis.AIRTABLE_CONFIG = CONFIG;
```

4. **Click "Run script"** - you should see "Base configuration loaded successfully!"

### Step 3: Test Individual Scripts

#### To Test the **Deploy Tracker Replacement**:
1. **Create new script**: "Deploy Tracker Test"
2. **Copy the entire content** from `realtime-release-monitor.js`
3. **Find this line** near the top:
   ```javascript
   const { FIELDS, CONFIG } = require('./current/versionreport.js');
   ```
4. **Replace it with**:
   ```javascript
   const FIELDS = globalThis.AIRTABLE_FIELDS;
   const CONFIG = globalThis.AIRTABLE_CONFIG;
   ```
5. **Scroll to the bottom** and find the example usage
6. **Change the version** from `'36.30'` to your current version (like `'37.00'`)
7. **Click "Run script"**
8. **You should see**: Real-time dashboard output with your current release data

#### To Test **Work Volume Report** (for milestone adherence):
1. **Create new script**: "Work Volume Test"
2. **Copy the entire content** from `work-volume-report.js`
3. **Replace the require line** (same as above)
4. **Change the version** in the example at the bottom
5. **Click "Run script"**
6. **You should see**: Work intensity analysis showing team overload

#### To Test **Milestone Adherence Report**:
1. **Create new script**: "Milestone Test"
2. **Copy the entire content** from `milestone-adherence-report.js`
3. **Replace the require line** (same as above)
4. **Click "Run script"**
5. **You should see**: Analysis of which teams miss milestones

#### To Test **Enhanced Version Report**:
1. **Create new script**: "Enhanced Version Test"
2. **Copy the entire content** from `enhanced-version-report.js`
3. **Replace the require line** (same as above)
4. **Change the version** in the example usage
5. **Click "Run script"**
6. **You should see**: Enhanced version of your current report with trends

---

## 🎯 Priority Testing Order

### **Start Here** (Most Important):
1. **Base Configuration** (required first)
2. **Real-Time Release Monitor** (Deploy Tracker replacement)
3. **Work Volume Report** (milestone adherence)
4. **Enhanced Version Report** (improved current report)

### **Then Test These**:
5. **Milestone Adherence Report**
6. **Hotfix Velocity Report**
7. **ShitHappens Analysis Report**
8. **Integration Pipeline Report**

### **Optional/Advanced**:
9. **Season Report**
10. **Component Team Report**
11. **Release Readiness Report**

---

## 🐛 Troubleshooting

### If You Get an Error:
1. **Check the field names**: The script uses field names like `'Build Version (Unified)'` - make sure these match your Airtable exactly
2. **Try a different version**: If `'36.30'` doesn't exist, change it to a version that does exist in your data
3. **Check the base configuration**: Make sure you ran the "Base Configuration" script first

### Common Error Messages:
- **"Field not found"**: The script is looking for a field that doesn't exist or is named differently
- **"Table not found"**: Make sure you're running this in the right Airtable base
- **"No data found"**: Try changing the version number to one that exists

### Field Name Differences:
If you get field errors, you might need to update the field names in the Base Configuration. Common differences:
- `'Build Version (Unified)'` might be `'Version'` in your base
- `'Created'` might be `'Date Created'`
- `'Priority'` might be `'Issue Priority'`

---

## 📊 What You'll See When Scripts Work

### **Deploy Tracker** Output:
```
🚀 Real-Time Release Monitor: 36.30

📊 Release Status Overview
Current Phase: Testing 🧪
Health Score: 85/100 🟢

🎯 Milestone Progress
- Hard Lock: 2024-06-11 ✅ 
- Pencils Down: 2024-06-21 🔄 (3 days)
- Cert Sub: 2024-06-26 🔄 (8 days)

🚢 Deploy Tracker
| Version | Status | Scheduled | State |
| 36.30 | Ready | 2024-06-30 | ✅ Ready |

🔥 Active Hotfixes (3)
🔴 ASAP: 1
🟠 Today: 2
```

### **Work Volume** Output:
```
📊 Work Volume Analysis Report

🎯 Executive Summary
Work Intensity: 67/100 ⚡ HIGH
Milestone Risk: MODERATE 🟡
Teams at Risk: 2 teams with excessive workload

📈 Volume Metrics Overview
Deploy Activity
- Total Deploys: 12
- Total Commits: 1,247
- RQA Whitegloves: 8
- Open Beyond PD: 5 🚨
```

### **Milestone Adherence** Output:
```
📅 Milestone Adherence Analysis Report

🎯 Executive Summary
Overall Adherence Rate: 73% 🟡
Releases On Time: 11/15
Teams at Risk: 3 teams with poor adherence

📊 Milestone Performance Analysis
| Milestone | Adherence Rate |
| HL Date | 85% 🟢 |
| PD Date | 67% 🟡 |
| Live Date | 78% 🟡 |
```

---

## 📞 Need Help?

### **If Scripts Don't Work**:
1. Double-check you ran "Base Configuration" first
2. Verify the version number exists in your data
3. Check that field names match exactly
4. Try with a simpler script first (like Enhanced Version Report)

### **If You Want to Modify**:
- You don't need to understand the code
- Just change version numbers, field names, or date ranges in the examples
- The scripts are designed to be safe to run multiple times

### **Ready for Production**:
Once scripts work in testing, you can set them up as automations using the **Airtable Setup Guide** document for full deployment.

---

This guide gives you everything you need to test each script without understanding the code - just copy, paste, and run!