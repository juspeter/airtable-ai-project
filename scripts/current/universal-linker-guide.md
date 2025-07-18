# Universal Linker - Configuration Guide

## Overview
The Universal Linker consolidates 7 separate linking scripts into one configurable script that handles all version-based linking operations.

## Replaces These Scripts:
- ✅ `builds-linkeddeploys.js`
- ✅ `builds-linkedmilestones.js` 
- ✅ `integrations-linkedbuild.js`
- ✅ `linked-integrations.js`
- ✅ `linker-hotfixes-to-builds.js`
- ✅ `linker-sh-to-builds.js`
- ✅ `shithappens-linked-build.js`

## Usage Methods

### Method 1: Predefined Configurations
Use built-in configurations for common linking scenarios:

#### Example Input Configurations:

**Link Build Deploys:**
```javascript
{
  "configName": "builds-deploys"
}
```

**Link Milestones to Builds:**
```javascript
{
  "configName": "builds-milestones"
}
```

**Link Integrations to Builds:**
```javascript
{
  "configName": "integrations-to-builds"
}
```

**Link Hotfixes to Builds:**
```javascript
{
  "configName": "hotfixes-to-builds"
}
```

**Link ShitHappens to Builds:**
```javascript
{
  "configName": "shithappens-to-builds"
}
```

**Lightweight Integration Linking:**
```javascript
{
  "configName": "integrations-light"
}
```

### Method 2: Custom Configuration
Create custom linking rules:

```javascript
{
  "mode": "child-parent",
  "sourceTable": "YourSourceTable",
  "targetTable": "Builds",
  "versionField": "Build Version (Unified)",
  "sourceLinkField": "Linked Build",
  "targetLinkField": "YourSourceTable",
  "targetFilter": {
    "Sync Source": "Scheduled Deploys",
    "Release Version": { "notContains": "HF" }
  }
}
```

### Method 3: Automation Triggered (Single Record)
For automation triggers, include the recordId:

```javascript
{
  "configName": "integrations-to-builds",
  "recordId": "recXXXXXXXXXXXXXX"
}
```

## Linking Modes

### 1. Peer Linking (`peer-linking`)
Links records within the same table that share the same version.

**Use Case:** Linking builds with the same version number
**Example:** All "36.30" builds get linked to each other

### 2. Child-Parent Linking (`child-parent`)
Links records from a source table to parent records in a target table, with two-way linking.

**Use Case:** Linking integrations to their parent builds
**Example:** Integration for "36.30" links to the main "36.30" build

### 3. Lightweight Child-Parent Linking (`child-parent-light`)
Links records to parents but only updates the child record (one-way).

**Use Case:** Quick linking for reporting views
**Example:** Integration links to build in Version Report view only

## Migration Guide

### Replace Old Automations

**Old Way:**
```
Automation 1: Trigger builds-linkeddeploys.js
Automation 2: Trigger builds-linkedmilestones.js
Automation 3: Trigger integrations-linkedbuild.js
... (7 separate automations)
```

**New Way:**
```
Automation 1: Trigger universal-linker.js with configName: "builds-deploys"
Automation 2: Trigger universal-linker.js with configName: "builds-milestones"
Automation 3: Trigger universal-linker.js with configName: "integrations-to-builds"
... (same script, different configs)
```

### Benefits of Migration
- **Reduced Maintenance:** 1 script instead of 7
- **Consistent Error Handling:** Standardized logging and error reporting
- **Better Performance:** Optimized batch processing
- **Unified Configuration:** All linking rules in one place
- **Enhanced Debugging:** Better logging and progress tracking

## Advanced Features

### Filtering
Apply filters to target records:

```javascript
{
  "targetFilter": {
    "Sync Source": "Scheduled Deploys",           // Exact match
    "Release Version": { "notContains": "HF" },   // Exclusion filter
    "Status": { "isNotEmpty": true }              // Existence check
  }
}
```

### Batch Processing
The script automatically handles large datasets with batched updates (50 records per batch).

### Error Handling
- Comprehensive error logging
- Graceful handling of missing records
- Validation of input parameters
- Progress tracking for large operations

## Monitoring and Debugging

The script provides detailed logging:
- 🚀 Configuration loaded
- 📊 Version groups found
- 🎯 Records needing updates
- 📝 Batch update progress
- ✅ Completion summary
- ❌ Error details

## Performance Notes

- **Batch Size:** 50 records per update batch (configurable)
- **Memory Efficient:** Processes records in chunks
- **Smart Updates:** Only updates records when changes are detected
- **Version Caching:** Creates efficient lookup maps for large datasets

## Testing

Test each configuration individually:

1. **Start Small:** Test with a single record using recordId
2. **Check Results:** Verify links are created correctly
3. **Scale Up:** Run full table linking
4. **Monitor Performance:** Check execution time and memory usage

## Troubleshooting

**Common Issues:**
- **Missing configName:** Ensure you're using a valid predefined configuration
- **Table Not Found:** Verify table names match exactly (case-sensitive)
- **Field Not Found:** Check that all field names exist in the tables
- **Permission Errors:** Ensure script has update permissions on all tables

**Debug Mode:**
Add extra logging by checking the console output for each step.