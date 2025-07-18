// Lightweight automation script - optimized for speed
// Links integration to correct build in Version Report only

const inputConfig = input.config();
const integrationId = inputConfig.recordId;

if (!integrationId) {
    throw new Error("No integration ID provided");
}

// Tables and fields
const integrationsTable = base.getTable("Integrations");
const versionReportView = base.getTable("Builds").getView("Version Report");

// Get integration version
const integration = await integrationsTable.selectRecordAsync(integrationId, {
    fields: ["Build Version (Unified)", "Linked Build"]
});

if (!integration) {
    throw new Error("Integration not found");
}

const version = integration.getCellValueAsString("Build Version (Unified)").trim();
if (!version) {
    output.set('result', 'No version');
    return;
}

// Check if already linked
const currentLink = integration.getCellValue("Linked Build");
if (currentLink && currentLink.length > 0) {
    output.set('result', 'Already linked');
    return;
}

// Find build in Version Report
const builds = await versionReportView.selectRecordsAsync({
    fields: ["Release Version"]
});

const correctBuild = builds.records.find(b => 
    b.getCellValueAsString("Release Version").trim() === version
);

if (!correctBuild) {
    output.set('result', 'No matching build');
    return;
}

// Link the integration
await integrationsTable.updateRecordAsync(integrationId, {
    "Linked Build": [{ id: correctBuild.id }]
});

output.set('result', 'Linked');
output.set('version', version);