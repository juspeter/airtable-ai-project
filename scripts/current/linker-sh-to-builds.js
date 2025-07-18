// A single script to link records from various tables to the 'Builds' table.
let inputConfig = input.config();
let sourceTableName = inputConfig.tableName;

if (!sourceTableName) {
    throw new Error("Input variable 'tableName' is missing. Please configure it in the automation settings.");
}
console.log(`Starting build linking process for table: '${sourceTableName}'...`);

// --- Table and Field Configuration ---
const buildsTable = base.getTable("Builds");
const sourceTable = base.getTable(sourceTableName);
const linkedBuildField = "Linked Build";
const versionField = "Build Version (Unified)";

// Step 1: Create a map of all valid "Scheduled Deploy" builds.
console.log("Fetching and mapping 'Builds' records...");
let buildsQuery = await buildsTable.selectRecordsAsync({
    fields: ["Sync Source", "Release Version", versionField]
});
let buildMap = {};
for (let build of buildsQuery.records) {
    if (build.getCellValue("Sync Source")?.name === "Scheduled Deploys" && !build.getCellValueAsString("Release Version")?.toUpperCase().includes("HF")) {
        let unifiedVer = build.getCellValueAsString(versionField);
        if (unifiedVer) {
            buildMap[unifiedVer.trim()] = build.id;
        }
    }
}
console.log(`Found ${Object.keys(buildMap).length} unique build versions to map to.`);

// Step 2: Query records from the source table and prepare updates.
console.log(`Querying records from '${sourceTableName}'...`);
let sourceRecords = await sourceTable.selectRecordsAsync({
    fields: [versionField, linkedBuildField]
});
let updates = [];
for (let record of sourceRecords.records) {
    let recordVersion = record.getCellValueAsString(versionField);
    if (!recordVersion || (record.getCellValue(linkedBuildField) || []).length > 0) {
        continue;
    }
    let buildId = buildMap[recordVersion.trim()];
    if (buildId) {
        updates.push({
            id: record.id,
            fields: { [linkedBuildField]: [{ id: buildId }] }
        });
    }
}

// Step 3: Batch update the source records.
if (updates.length > 0) {
    console.log(`Found ${updates.length} records in '${sourceTableName}' to update.`);
    for (let i = 0; i < updates.length; i += 50) {
        await sourceTable.updateRecordsAsync(updates.slice(i, i + 50));
    }
} else {
    console.log(`No records needed updating in '${sourceTableName}'.`);
}
console.log("✅ Process complete.");