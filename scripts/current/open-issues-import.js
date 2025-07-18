// Airtable Automation Script
// Trigger: Daily at 3 AM

const buildsTable = base.getTable("Builds");

// Get all active versions
const activeBuilds = await buildsTable.selectRecordsAsync({
    fields: ["Build Version (Unified)", "Build Status (Unified)"],
    filterByFormula: 'NOT({Build Status (Unified)} = "Sunset")'
});

// Get unique versions
const versions = [...new Set(activeBuilds.records
    .map(r => r.getCellValue("Build Version (Unified)"))
    .filter(v => v))];

console.log(`Found ${versions.length} active versions to update`);

// For each version, calculate current metrics
for (const version of versions) {
    // This would either:
    // 1. Call JIRA API (if inside VPN)
    // 2. Read from cache table
    // 3. Calculate from existing data
    
    const metrics = await calculateMetricsForVersion(version);
    
    // Update all records for this version
    const recordsToUpdate = activeBuilds.records
        .filter(r => r.getCellValue("Build Version (Unified)") === version)
        .map(r => ({
            id: r.id,
            fields: {
                "Open Issues Current": metrics.currentCount,
                "Issues Last Updated": new Date().toISOString()
            }
        }));
    
    await buildsTable.updateRecordsAsync(recordsToUpdate);
}