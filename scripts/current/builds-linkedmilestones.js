// Scans the Builds table and links milestone-type rows to their parent version row.
// VERSION 2: Includes improved logging for update confirmation.

console.log("Starting process to link milestones to parent builds...");
const buildsTable = base.getTable("Builds");
const recordsQuery = await buildsTable.selectRecordsAsync({
    fields: ["Milestone Type", "Build Version (Unified)", "Linked Milestones"]
});

let milestoneMap = {};

// Pass 1: Map all milestone records by their version number.
console.log("Pass 1: Mapping all milestone records...");
for (let record of recordsQuery.records) {
    if (record.getCellValue("Milestone Type")) {
        let version = record.getCellValueAsString("Build Version (Unified)");
        if (version) {
            let key = version.trim();
            if (!milestoneMap[key]) milestoneMap[key] = [];
            milestoneMap[key].push({ id: record.id });
        }
    }
}
console.log(`Found milestones for ${Object.keys(milestoneMap).length} unique versions.`);

// Pass 2: Prepare updates for parent build records.
console.log("Pass 2: Preparing updates for parent build records...");
let updates = [];
for (let record of recordsQuery.records) {
    let version = record.getCellValueAsString("Build Version (Unified)");
    if (!version) continue;
    let key = version.trim();
    let milestoneLinks = milestoneMap[key];
    if (milestoneLinks && !record.getCellValue("Milestone Type")) {
        updates.push({
            id: record.id,
            fields: { "Linked Milestones": milestoneLinks }
        });
    }
}

// Batch apply the updates.
if (updates.length > 0) {
    console.log(`Found ${updates.length} parent records to update.`);
    // Loop through the updates in batches of 50
    for (let i = 0; i < updates.length; i += 50) {
        const batch = updates.slice(i, i + 50);
        await buildsTable.updateRecordsAsync(batch);
        // NEW: This log confirms each batch was processed.
        console.log(`Updated batch ${i/50 + 1} of ${Math.ceil(updates.length / 50)}...`);
    }
} else {
    console.log("No parent records needed updating.");
}

// NEW: The success message is now more specific.
console.log(`✅ Milestone linking process complete. A total of ${updates.length} records were updated.`);