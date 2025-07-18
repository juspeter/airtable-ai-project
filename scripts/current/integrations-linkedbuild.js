// A single, efficient script to create a two-way link between an Integration and its parent Build(s).
// VERSION 3: Fetches the required "Integrations" field to prevent errors.

console.log("Starting two-way integration linking...");

const inputConfig = input.config();
const integrationId = inputConfig.recordId;

if (!integrationId) {
    throw new Error("This script must be run from an automation triggered by an Airtable record.");
}

// --- Configuration ---
const integrationsTable = base.getTable("Integrations");
const buildsTable = base.getTable("Builds");
const versionField = "Build Version (Unified)";
const integrationsLinkFieldOnBuilds = "Integrations"; // Field on 'Builds' table linking to Integrations
const buildsLinkFieldOnIntegrations = "Linked Build"; // Field on 'Integrations' table linking to Builds

// Step 1: Get the integration record and its version
const integrationRecord = await integrationsTable.selectRecordAsync(integrationId, {
    fields: [versionField, buildsLinkFieldOnIntegrations]
});

if (!integrationRecord) {
    console.log(`Integration record ${integrationId} not found. Exiting.`);
    return;
}

const version = integrationRecord.getCellValueAsString(versionField);
if (!version || version.trim() === "") {
    console.log("Integration record has no version. Exiting.");
    return;
}
const trimmedVersion = version.trim();
console.log(`Found integration version: '${trimmedVersion}'`);

// Step 2: Find all matching parent builds (that are not milestones)
const potentialBuilds = await buildsTable.selectRecordsAsync({
    // --- THIS IS THE FIX ---
    // We must include the "Integrations" linked field here so we can read it later.
    fields: [versionField, "Milestone Type", integrationsLinkFieldOnBuilds]
});

const matchedBuilds = potentialBuilds.records.filter(build => {
    const buildVersion = build.getCellValueAsString(versionField);
    return buildVersion && (buildVersion.trim() === trimmedVersion) && !build.getCellValue("Milestone Type");
});

if (matchedBuilds.length === 0) {
    console.log(`No parent builds found for version '${trimmedVersion}'. Exiting.`);
    return;
}
console.log(`Found ${matchedBuilds.length} matching parent build(s).`);

const matchedBuildIds = matchedBuilds.map(build => ({ id: build.id }));

// Step 3: Update the Integration record to link to the build(s)
await integrationsTable.updateRecordAsync(integrationId, {
    [buildsLinkFieldOnIntegrations]: matchedBuildIds
});
console.log(`Updated integration record ${integrationId} with link to build(s).`);

// Step 4: Update the Build record(s) to link back to this integration
console.log("Updating parent build(s) with back-reference to the integration...");
const buildUpdates = matchedBuilds.map(build => {
    // This line will now work correctly because the field was fetched in Step 2.
    const existingLinks = build.getCellValue(integrationsLinkFieldOnBuilds) || [];
    const existingIds = new Set(existingLinks.map(link => link.id));
    if (!existingIds.has(integrationId)) {
        return {
            id: build.id,
            fields: {
                [integrationsLinkFieldOnBuilds]: [...existingLinks, { id: integrationId }]
            }
        };
    }
    return null;
}).filter(Boolean);

if (buildUpdates.length > 0) {
    for (let i = 0; i < buildUpdates.length; i += 50) {
        await buildsTable.updateRecordsAsync(buildUpdates.slice(i, i + 50));
    }
    console.log(`Updated ${buildUpdates.length} parent build(s) with the integration link.`);
} else {
    console.log("Parent build(s) were already up to date.");
}

console.log("✅ Two-way linking process complete.");