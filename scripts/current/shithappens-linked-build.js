// Step 1: Build map of valid builds
let buildsTable = base.getTable("Builds");
let builds = await buildsTable.selectRecordsAsync();

let buildMap = {};
for (let build of builds.records) {
    let source = build.getCellValue("Sync Source");
    let sourceName = source?.name;
    let schedVer = build.getCellValue("Release Version");
    let unifiedVer = build.getCellValue("Build Version (Unified)");

    if (
        sourceName === "Scheduled Deploys" &&
        typeof schedVer === "string" &&
        !schedVer.toUpperCase().includes("HF") &&
        typeof unifiedVer === "string"
    ) {
        buildMap[unifiedVer.trim()] = build.id;
    }
}

// Step 2: Link Integrations
let irTable = base.getTable("ShitHappens");
let irRecords = await irTable.selectRecordsAsync();

let updates = [];
for (let record of irRecords.records) {
    let version = record.getCellValue("Build Version (Unified)");
    if (!version || typeof version !== "string") continue;

    let cleanVersion = version.trim();
    let buildId = buildMap[cleanVersion];

    if (buildId) {
        updates.push({
            id: record.id,
            fields: {
                "Linked Build": [{ id: buildId }]
            }
        });
    }
}

// Batch update
while (updates.length > 0) {
    await irTable.updateRecordsAsync(updates.slice(0, 50));
    updates = updates.slice(50);
}
