//======================================================================================================================
// Universal Linker Script
// Purpose: Consolidated script to handle all version-based linking operations between tables
// Replaces: builds-linkeddeploys.js, builds-linkedmilestones.js, integrations-linkedbuild.js, 
//           linked-integrations.js, linker-hotfixes-to-builds.js, linker-sh-to-builds.js, 
//           shithappens-linked-build.js
//======================================================================================================================

console.log("🔗 Universal Linker v1.0 - Starting...");

// Get configuration from input
const inputConfig = input.config();
const linkingMode = inputConfig.mode || 'peer-linking'; // peer-linking | parent-child | child-parent
const sourceTable = inputConfig.sourceTable;
const targetTable = inputConfig.targetTable || 'Builds';
const recordId = inputConfig.recordId; // For automation triggers

//======================================================================================================================
// LINKING CONFIGURATIONS
// Each configuration defines how to link records between tables
//======================================================================================================================

const LINK_CONFIGS = {
    // Peer-to-peer linking within same table (e.g., linking builds with same version)
    'builds-deploys': {
        mode: 'peer-linking',
        table: 'Builds',
        versionField: 'Build Version (Unified)',
        linkField: 'Linked Deploys',
        description: 'Links build records with same version'
    },
    
    'builds-milestones': {
        mode: 'peer-linking',
        table: 'Builds',
        versionField: 'Build Version (Unified)',
        linkField: 'Linked Milestones',
        filter: { 'Milestone Type': { isNotEmpty: true } },
        description: 'Links milestone-type builds to parent builds'
    },
    
    // Parent-child linking (source finds its parent)
    'integrations-to-builds': {
        mode: 'child-parent',
        sourceTable: 'Integrations',
        targetTable: 'Builds',
        versionField: 'Build Version (Unified)',
        sourceLinkField: 'Linked Build',
        targetLinkField: 'Integrations',
        targetFilter: { 
            'Sync Source': 'Scheduled Deploys',
            'Release Version': { notContains: 'HF' }
        },
        description: 'Links integrations to their parent builds'
    },
    
    'hotfixes-to-builds': {
        mode: 'child-parent',
        sourceTable: 'Hotfixes',
        targetTable: 'Builds',
        versionField: 'Build Version (Unified)',
        sourceLinkField: 'Linked Build',
        targetLinkField: 'Hotfixes',
        targetFilter: { 
            'Sync Source': 'Scheduled Deploys',
            'Release Version': { notContains: 'HF' }
        },
        description: 'Links hotfixes to their parent builds'
    },
    
    'shithappens-to-builds': {
        mode: 'child-parent',
        sourceTable: 'ShitHappens',
        targetTable: 'Builds',
        versionField: 'Build Version (Unified)',
        sourceLinkField: 'Linked Build',
        targetLinkField: 'ShitHappens',
        targetFilter: { 
            'Sync Source': 'Scheduled Deploys',
            'Release Version': { notContains: 'HF' }
        },
        description: 'Links ShitHappens records to their parent builds'
    },
    
    // Lightweight linking (Version Report view only)
    'integrations-light': {
        mode: 'child-parent-light',
        sourceTable: 'Integrations',
        targetTable: 'Builds',
        targetView: 'Version Report',
        versionField: 'Build Version (Unified)',
        sourceLinkField: 'Linked Build',
        description: 'Lightweight integration linking for Version Report view'
    }
};

//======================================================================================================================
// UTILITY FUNCTIONS
//======================================================================================================================

function trimVersion(version) {
    if (!version) return null;
    // Remove common prefixes and normalize
    return version.replace(/^(Release\s+|Version\s+|v\.?)/i, '').trim();
}

function createVersionMap(records, versionField, filter = null) {
    const map = {};
    for (let record of records) {
        // Apply filter if specified
        if (filter && !matchesFilter(record, filter)) continue;
        
        const version = trimVersion(record.getCellValueAsString(versionField));
        if (version) {
            if (!map[version]) map[version] = [];
            map[version].push(record);
        }
    }
    return map;
}

function matchesFilter(record, filter) {
    for (let [fieldName, condition] of Object.entries(filter)) {
        const fieldValue = record.getCellValue(fieldName);
        
        if (condition.isNotEmpty) {
            if (!fieldValue) return false;
        } else if (condition.notContains) {
            const stringValue = record.getCellValueAsString(fieldName) || '';
            if (stringValue.toUpperCase().includes(condition.notContains.toUpperCase())) return false;
        } else if (typeof condition === 'string') {
            const cellValue = fieldValue?.name || record.getCellValueAsString(fieldName);
            if (cellValue !== condition) return false;
        }
    }
    return true;
}

async function updateRecordsInBatches(table, updates, batchSize = 50) {
    console.log(`📝 Updating ${updates.length} records in batches of ${batchSize}...`);
    
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        try {
            await table.updateRecordsAsync(batch);
            console.log(`✅ Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(updates.length/batchSize)}`);
        } catch (error) {
            console.error(`❌ Error updating batch ${Math.floor(i/batchSize) + 1}:`, error);
            throw error;
        }
    }
}

//======================================================================================================================
// LINKING STRATEGIES
//======================================================================================================================

async function executePeerLinking(config) {
    console.log(`🔄 Executing peer linking for ${config.table}...`);
    
    const table = base.getTable(config.table);
    const query = await table.selectRecordsAsync({
        fields: [config.versionField, config.linkField]
    });
    
    // Group records by version
    const recordsByVersion = createVersionMap(query.records, config.versionField, config.filter);
    console.log(`📊 Found ${Object.keys(recordsByVersion).length} unique version groups`);
    
    // Prepare updates
    const updates = [];
    for (let record of query.records) {
        const version = trimVersion(record.getCellValueAsString(config.versionField));
        if (!version || !recordsByVersion[version]) continue;
        
        // Find peers (excluding self)
        const peers = recordsByVersion[version].filter(peer => peer.id !== record.id);
        if (peers.length === 0) continue;
        
        // Check if update is needed
        const currentLinks = record.getCellValue(config.linkField) || [];
        const currentLinkIds = new Set(currentLinks.map(link => link.id));
        const newLinkIds = new Set(peers.map(peer => peer.id));
        
        // Only update if links have changed
        if (!setsEqual(currentLinkIds, newLinkIds)) {
            updates.push({
                id: record.id,
                fields: {
                    [config.linkField]: peers.map(peer => ({ id: peer.id }))
                }
            });
        }
    }
    
    console.log(`🎯 Found ${updates.length} records needing updates`);
    if (updates.length > 0) {
        await updateRecordsInBatches(table, updates);
    }
    
    return updates.length;
}

async function executeChildParentLinking(config) {
    console.log(`🔄 Executing child-parent linking: ${config.sourceTable} → ${config.targetTable}...`);
    
    const sourceTable = base.getTable(config.sourceTable);
    const targetTable = base.getTable(config.targetTable);
    
    // Get target records (builds) and create version map
    const targetQuery = await targetTable.selectRecordsAsync({
        fields: ['Sync Source', 'Release Version', config.versionField, config.targetLinkField]
    });
    
    const targetMap = createVersionMap(targetQuery.records, config.versionField, config.targetFilter);
    console.log(`🎯 Found ${Object.keys(targetMap).length} target versions available for linking`);
    
    // Handle single record vs batch processing
    let sourceRecords;
    if (recordId) {
        // Single record mode (triggered by automation)
        const sourceRecord = await sourceTable.selectRecordAsync(recordId, {
            fields: [config.versionField, config.sourceLinkField]
        });
        sourceRecords = sourceRecord ? [sourceRecord] : [];
    } else {
        // Batch mode (process all records)
        const sourceQuery = await sourceTable.selectRecordsAsync({
            fields: [config.versionField, config.sourceLinkField]
        });
        sourceRecords = sourceQuery.records;
    }
    
    console.log(`📋 Processing ${sourceRecords.length} source records...`);
    
    // Prepare updates for source records
    const sourceUpdates = [];
    const targetUpdatesMap = new Map();
    
    for (let sourceRecord of sourceRecords) {
        const version = trimVersion(sourceRecord.getCellValueAsString(config.versionField));
        if (!version || !targetMap[version]) {
            console.log(`⚠️  No target found for version: ${version}`);
            continue;
        }
        
        // Get the best target record (first one in the version group)
        const targetRecord = targetMap[version][0];
        
        // Update source record to link to target
        const currentSourceLink = sourceRecord.getCellValue(config.sourceLinkField);
        const targetLinkId = targetRecord.id;
        
        if (!currentSourceLink || currentSourceLink[0]?.id !== targetLinkId) {
            sourceUpdates.push({
                id: sourceRecord.id,
                fields: {
                    [config.sourceLinkField]: [{ id: targetLinkId }]
                }
            });
        }
        
        // Prepare target update (add source to target's link field)
        if (!targetUpdatesMap.has(targetLinkId)) {
            const currentTargetLinks = targetRecord.getCellValue(config.targetLinkField) || [];
            targetUpdatesMap.set(targetLinkId, {
                id: targetLinkId,
                currentLinks: new Set(currentTargetLinks.map(link => link.id)),
                newLinks: new Set()
            });
        }
        
        targetUpdatesMap.get(targetLinkId).newLinks.add(sourceRecord.id);
    }
    
    // Apply source updates
    if (sourceUpdates.length > 0) {
        console.log(`📝 Updating ${sourceUpdates.length} source records...`);
        await updateRecordsInBatches(sourceTable, sourceUpdates);
    }
    
    // Apply target updates
    const targetUpdates = [];
    for (let [targetId, updateInfo] of targetUpdatesMap) {
        const finalLinks = new Set([...updateInfo.currentLinks, ...updateInfo.newLinks]);
        
        if (!setsEqual(updateInfo.currentLinks, finalLinks)) {
            targetUpdates.push({
                id: targetId,
                fields: {
                    [config.targetLinkField]: Array.from(finalLinks).map(id => ({ id }))
                }
            });
        }
    }
    
    if (targetUpdates.length > 0) {
        console.log(`📝 Updating ${targetUpdates.length} target records...`);
        await updateRecordsInBatches(targetTable, targetUpdates);
    }
    
    return sourceUpdates.length + targetUpdates.length;
}

async function executeChildParentLightLinking(config) {
    console.log(`🔄 Executing lightweight child-parent linking: ${config.sourceTable} → ${config.targetTable}...`);
    
    const sourceTable = base.getTable(config.sourceTable);
    const targetTable = base.getTable(config.targetTable);
    
    // Get target records from specific view
    const targetQuery = await targetTable.selectRecordsAsync({
        view: config.targetView,
        fields: [config.versionField]
    });
    
    const targetMap = createVersionMap(targetQuery.records, config.versionField);
    console.log(`🎯 Found ${Object.keys(targetMap).length} target versions in ${config.targetView} view`);
    
    // Get source records
    const sourceQuery = await sourceTable.selectRecordsAsync({
        fields: [config.versionField, config.sourceLinkField]
    });
    
    const sourceUpdates = [];
    for (let sourceRecord of sourceQuery.records) {
        const version = trimVersion(sourceRecord.getCellValueAsString(config.versionField));
        if (!version || !targetMap[version]) continue;
        
        const targetRecord = targetMap[version][0];
        const currentLink = sourceRecord.getCellValue(config.sourceLinkField);
        
        if (!currentLink || currentLink[0]?.id !== targetRecord.id) {
            sourceUpdates.push({
                id: sourceRecord.id,
                fields: {
                    [config.sourceLinkField]: [{ id: targetRecord.id }]
                }
            });
        }
    }
    
    if (sourceUpdates.length > 0) {
        await updateRecordsInBatches(sourceTable, sourceUpdates);
    }
    
    return sourceUpdates.length;
}

//======================================================================================================================
// UTILITY FUNCTIONS
//======================================================================================================================

function setsEqual(set1, set2) {
    if (set1.size !== set2.size) return false;
    for (let item of set1) {
        if (!set2.has(item)) return false;
    }
    return true;
}

//======================================================================================================================
// MAIN EXECUTION
//======================================================================================================================

async function main() {
    try {
        // Determine which configuration to use
        let config;
        
        if (inputConfig.configName) {
            // Use predefined configuration
            config = LINK_CONFIGS[inputConfig.configName];
            if (!config) {
                throw new Error(`Configuration '${inputConfig.configName}' not found. Available: ${Object.keys(LINK_CONFIGS).join(', ')}`);
            }
        } else {
            // Use custom configuration from input
            config = {
                mode: linkingMode,
                sourceTable: sourceTable,
                targetTable: targetTable,
                ...inputConfig
            };
        }
        
        console.log(`🚀 Configuration: ${config.description || 'Custom configuration'}`);
        console.log(`📋 Mode: ${config.mode}`);
        
        let updatedCount = 0;
        
        // Execute appropriate linking strategy
        switch (config.mode) {
            case 'peer-linking':
                updatedCount = await executePeerLinking(config);
                break;
                
            case 'child-parent':
                updatedCount = await executeChildParentLinking(config);
                break;
                
            case 'child-parent-light':
                updatedCount = await executeChildParentLightLinking(config);
                break;
                
            default:
                throw new Error(`Unknown linking mode: ${config.mode}`);
        }
        
        console.log(`✅ Universal Linker completed successfully!`);
        console.log(`📊 Total records updated: ${updatedCount}`);
        
        return {
            success: true,
            updatedCount: updatedCount,
            configuration: config.description || 'Custom configuration'
        };
        
    } catch (error) {
        console.error("❌ Universal Linker failed:", error);
        throw error;
    }
}

// Execute the main function
await main();