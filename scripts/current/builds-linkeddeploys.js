// Scans the Builds table and links records that share the same "Build Version (Unified)" value.
console.log("Starting process to link peer deploy records...");
const buildsTable = base.getTable("Builds");
const versionFieldName = "Build Version (Unified)";
const linkedFieldName = "Linked Deploys";

const allRecordsQuery = await buildsTable.selectRecordsAsync({
    fields: [versionFieldName, linkedFieldName]
});

// Pass 1: Group all records by their version number.
console.log("Pass 1: Grouping all records by version...");
let recordsByVersion = {};
for (let record of allRecordsQuery.records) {
    let version = record.getCellValueAsString(versionFieldName);
    if (version) {
        if (!recordsByVersion[version]) recordsByVersion[version] = [];
        recordsByVersion[version].push(record);
    }
}
console.log(`Found ${Object.keys(recordsByVersion).length} unique version groups.`);

// Pass 2: For each record, find its peers and prepare the update.
console.log("Pass 2: Preparing updates...");
let updates = [];
for (let record of allRecordsQuery.records) {
    let version = record.getCellValueAsString(versionFieldName);
    if (!version || !recordsByVersion[version]) continue;

    const peerLinks = recordsByVersion[version]
        .filter(peer => peer.id !== record.id)
        .map(peer => ({ id: peer.id }));

    const currentLinks = record.getCellValue(linkedFieldName) || [];
    const currentIds = currentLinks.map(link => link.id).sort();
    const targetIds = peerLinks.map(link => link.id).sort();

    if (currentIds.length !== targetIds.length || !currentIds.every((id, i) => id === targetIds[i])) {
        updates.push({
            id: record.id,
            fields: { [linkedFieldName]: peerLinks }
        });
    }
}

// Batch update the records.
if (updates.length > 0) {
    console.log(`Found ${updates.length} records to update.`);
    for (let i = 0; i < updates.length; i += 50) {
        await buildsTable.updateRecordsAsync(updates.slice(i, i + 50));
    }
} else {
    console.log("No deploy links needed updating.");
}
console.log("✅ Peer deploy linking process complete.");