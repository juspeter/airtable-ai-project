// This script runs when a new "Build" record is created.
// It finds all matching "Integration" records and links them.

// Define the tables we'll be working with
const buildsTable = base.getTable("Builds");
const integrationsTable = base.getTable("Integrations");

// --- Configuration ---
// Get the record that triggered the automation
const inputConfig = input.config();
const buildRecordId = inputConfig.recordId;
const buildVersion = inputConfig.buildVersion;

console.log(`▶️ Starting process for new build record: ${buildRecordId}`);

// --- Main Script Logic ---
try {
    // 1. Validate the input from the trigger
    if (!buildVersion || buildVersion.trim() === "") {
        console.log("🚫 Build version is empty. Exiting.");
        return;
    }

    // 2. Find all "Integration" records that match the new build's version
    const integrationsQuery = await integrationsTable.selectRecordsAsync({
        fields: ["Record ID"], // We only need the ID for linking
        filterByFormula: `{Build Version (Unified)} = "${buildVersion}"`
    });

    const matchingIntegrationIds = integrationsQuery.records.map(record => ({ id: record.id }));

    if (matchingIntegrationIds.length === 0) {
        console.log(`✅ No integrations found for version ${buildVersion}. Nothing to link.`);
        return;
    }
    
    console.log(`🔍 Found ${matchingIntegrationIds.length} integration(s) to link.`);

    // 3. Update the newly created "Build" record with the integration links
    await buildsTable.updateRecordAsync(buildRecordId, {
        "Integrations": matchingIntegrationIds
    });

    console.log(`✅ Successfully linked ${matchingIntegrationIds.length} integration(s) to build ${buildRecordId}.`);
    output.text(`Linked ${matchingIntegrationIds.length} integration(s).`);

} catch (error) {
    console.error(`❌ An error occurred: ${error.message}`);
    output.text(`❌ An error occurred. Check the automation run logs for details.`);
    throw error;
}