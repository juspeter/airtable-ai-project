/*
 * =================================================================================================
 * AIRTABLE AUTOMATION SCRIPT: Sync Commit Counts from Grafana Data to Builds Table
 * =================================================================================================
 *
 * PURPOSE:
 * This script aggregates commit counts from the 'Grafana Data' table and updates corresponding
 * numeric fields in the 'Builds' table. It is designed to run in an Airtable Automation,
 * which is more stable than the Scripting Extension for this type of data processing.
 *
 * HOW TO USE:
 * 1. Open the "Automations" panel in your Airtable base.
 * 2. Create a new automation.
 * 3. Choose a trigger. For this task, "At a scheduled time" (e.g., daily) or
 * "When a button is clicked" are good options.
 * 4. Add an action and select "Run a script".
 * 5. Paste this entire script into the script editor.
 * 6. VERY IMPORTANT: Review and update the `CONFIG` section below to match your exact
 * table and field names.
 * 7. Test the automation, then turn it on.
 *
 * v5 Change: Corrected 'Pre-Hard Lock' to 'Before Hard Lock' in the config map to match source data.
 */

// --- CONFIGURATION ---
// IMPORTANT: Update these values to match your base's structure.
const CONFIG = {
    // Source table containing commit data
    grafanaTable: {
        name: 'Grafana Data',
        fields: {
            stream: 'Stream',           // Field with value like "Release-36.10"
            capturePoint: 'Capture Point', // Field with milestone name
            value: 'Value'              // The numeric commit count
        }
    },
    // Destination table to update
    buildsTable: {
        name: 'Builds',
        fields: {
            // The key field for matching, e.g., "36.10"
            version: 'Build Version (Unified)',
            // The mapping from 'Capture Point' in Grafana Data to fields in Builds
            // Key: Value from 'Capture Point' field
            // Value: Field name in 'Builds' table to update
            commitFieldMap: {
                'Before Hard Lock': 'Commits: Pre-Hard Lock', // <-- CORRECTED THIS LINE
                'Hard Lock -> Pencils Down': 'Commits: Hard Lock → Pencils Down',
                'Pencils Down -> Cert Sub': 'Commits: Pencils Down → Cert Sub',
                'Cert Sub -> Live': 'Commits: Cert Sub → Live',
                'Live+': 'Commits: Live+',
            }
        }
    }
};

console.log('🚀 Starting Commit Sync Script');

// --- Main Script Logic ---
try {
    // 1. Fetch and Aggregate Data from the Grafana Table
    // ========================================================
    console.log('Step 1: Fetching and aggregating data from `Grafana Data` table...');

    const grafanaTable = base.getTable(CONFIG.grafanaTable.name);
    const grafanaQuery = await grafanaTable.selectRecordsAsync({
        fields: [
            CONFIG.grafanaTable.fields.stream,
            CONFIG.grafanaTable.fields.capturePoint,
            CONFIG.grafanaTable.fields.value
        ]
    });

    const aggregatedCommits = {};
    // { "36.10": { "Before Hard Lock": 150, "Hard Lock -> Pencils Down": 200 }, ... }

    for (const record of grafanaQuery.records) {
        const streamName = record.getCellValueAsString(CONFIG.grafanaTable.fields.stream);
        // Trim whitespace from the capture point value to avoid matching errors
        const capturePoint = record.getCellValueAsString(CONFIG.grafanaTable.fields.capturePoint).trim();
        const commitValue = record.getCellValue(CONFIG.grafanaTable.fields.value);

        // --- Data Validation and Parsing ---
        if (!streamName || !capturePoint || typeof commitValue !== 'number') {
            console.warn(`Skipping record with invalid data: ID=${record.id}, Stream=${streamName}, CapturePoint=${capturePoint}, Value=${commitValue}`);
            continue;
        }

        // Extract version number (e.g., "Release-36.10" -> "36.10")
        const versionMatch = streamName.match(/(\d+\.\d+)$/);
        if (!versionMatch) {
            console.warn(`Could not extract version from stream: "${streamName}"`);
            continue;
        }
        const version = versionMatch[1];

        // --- Aggregation Logic ---
        if (!aggregatedCommits[version]) {
            aggregatedCommits[version] = {};
        }

        // Sum values if the same version/capture point appears multiple times
        if (!aggregatedCommits[version][capturePoint]) {
            aggregatedCommits[version][capturePoint] = 0;
        }
        aggregatedCommits[version][capturePoint] += commitValue;
    }
    console.log(`✅ Aggregated commit data for ${Object.keys(aggregatedCommits).length} unique versions.`);
    
    // --- DETAILED DEBUGGING LOG ---
    // This will show you the final aggregated numbers before they are written.
    console.log('--- Final Aggregated Data ---');
    console.log(JSON.stringify(aggregatedCommits, null, 2)); // Using JSON.stringify for cleaner log output
    console.log('---------------------------');


    // 2. Prepare Updates for the Builds Table
    // ========================================================
    console.log('Step 2: Preparing updates for `Builds` table...');
    const buildsTable = base.getTable(CONFIG.buildsTable.name);
    const buildsQuery = await buildsTable.selectRecordsAsync({
        fields: [CONFIG.buildsTable.fields.version] // Only need the version to match
    });

    const updates = [];
    for (const buildRecord of buildsQuery.records) {
        const buildVersion = buildRecord.getCellValueAsString(CONFIG.buildsTable.fields.version);

        if (aggregatedCommits[buildVersion]) {
            const updatePayload = {
                id: buildRecord.id,
                fields: {}
            };
            let hasUpdate = false;

            // Map the aggregated data to the corresponding fields in the Builds table
            for (const [capturePoint, commitFieldName] of Object.entries(CONFIG.buildsTable.fields.commitFieldMap)) {
                const commitCount = aggregatedCommits[buildVersion][capturePoint] || 0; // Default to 0 if no data
                updatePayload.fields[commitFieldName] = commitCount;
                hasUpdate = true;
            }

            if (hasUpdate) {
                updates.push(updatePayload);
            }
        }
    }
    console.log(`✅ Prepared ${updates.length} records in the 'Builds' table for update.`);


    // 3. Execute Batched Updates
    // ========================================================
    // Airtable's updateRecordsAsync can only handle 50 records at a time.
    console.log('Step 3: Applying updates in batches...');
    if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += 50) {
            const batch = updates.slice(i, i + 50);
            await buildsTable.updateRecordsAsync(batch);
            console.log(`- Updated batch ${Math.floor(i/50) + 1} of ${Math.ceil(updates.length/50)}`);
        }
    } else {
        console.log('- No updates to apply.');
    }


    console.log('✅ Success! All records processed.');

} catch (error) {
    console.error('❌ An error occurred');
    console.error(error);
    // Re-throwing the error can be useful for some Airtable error-handling workflows
    throw error;
}
