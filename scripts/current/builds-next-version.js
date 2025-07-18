let buildsTable = base.getTable("Builds");
let builds = await buildsTable.selectRecordsAsync({fields: [
    "Build Version (Unified)", "Live Date", "Deploy Type", "Sync Source", "Next Version"
]});

// Clean version check
function isCleanVersion(str) {
    return /^\d+\.\d+$/.test(str);
}

// Candidate map
let versionMap = [];

for (let record of builds.records) {
    let version = record.getCellValueAsString("Build Version (Unified)");
    let liveDate = record.getCellValue("Live Date");
    let type = record.getCellValueAsString("Deploy Type");
    let source = record.getCellValueAsString("Sync Source");

    if (
        source !== "Scheduled Deploys" ||
        type !== "Major Release" ||
        !isCleanVersion(version) ||
        !liveDate
    ) {
        continue;
    }

    versionMap.push({
        id: record.id,
        version,
        liveDate: new Date(liveDate)
    });
}

// Build updates
let updates = [];

for (let record of builds.records) {
    let currentId = record.id;
    let currentLive = record.getCellValue("Live Date");
    let currentVersion = record.getCellValueAsString("Build Version (Unified)");

    if (!currentLive || !isCleanVersion(currentVersion)) continue;

    let currentDate = new Date(currentLive);
    if (isNaN(currentDate)) continue;

    let next = versionMap
        .filter(v => v.liveDate > currentDate)
        .sort((a, b) => a.liveDate - b.liveDate)[0];

    if (next) {
        updates.push({
            id: currentId,
            fields: {
                "Next Version": [{ id: next.id }]
            }
        });
    }
}

// Apply updates in batches of 50
while (updates.length > 0) {
    await buildsTable.updateRecordsAsync(updates.slice(0, 50));
    updates = updates.slice(50);
}

return `✅ Script complete: ${versionMap.length} future candidates scanned. ${updates.length} updated.`;
