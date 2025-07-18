let table = base.getTable("Builds");

// Config
let inputConfig = input.config();
let recordId = inputConfig.recordId;

let record = await table.selectRecordAsync(recordId);
if (!record) throw new Error("Record not found.");

// Field names
let versionUnifiedField = "Build Version (Unified)";
let versionSelectField = "Version Filter";
let seasonUnifiedField = "Season (Unified)";
let seasonSelectField = "Season Filter";
let chapterUnifiedField = "BR Chapter (Unified)";
let chapterSelectField = "Chapter Filter";

// Get values
let versionUnified = record.getCellValueAsString(versionUnifiedField);
let seasonUnified = record.getCellValueAsString(seasonUnifiedField);
let chapterUnified = record.getCellValueAsString(chapterUnifiedField);

// Helpers: Check if a value is valid for a single select field
function isValidSelect(field, value) {
    return field.options.choices.some(option => option.name === value);
}

// Get field metadata for validation
let versionField = table.getField(versionSelectField);
let seasonField = table.getField(seasonSelectField);
let chapterField = table.getField(chapterSelectField);

let fieldsToUpdate = {};

if (versionUnified && isValidSelect(versionField, versionUnified)) {
    fieldsToUpdate[versionSelectField] = { name: versionUnified };
}
if (seasonUnified && isValidSelect(seasonField, seasonUnified)) {
    fieldsToUpdate[seasonSelectField] = { name: seasonUnified };
}
if (chapterUnified && isValidSelect(chapterField, chapterUnified)) {
    fieldsToUpdate[chapterSelectField] = { name: chapterUnified };
}

if (Object.keys(fieldsToUpdate).length > 0) {
    await table.updateRecordAsync(recordId, fieldsToUpdate);
}
