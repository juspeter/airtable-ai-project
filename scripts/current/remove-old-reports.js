// Get all input variables at once (call input.config() only ONCE)
let config = input.config();
let table = base.getTable('Generated Reports');
let versionCovered = config['Version Covered'];
let newRecordId = config['Record ID'];

// Fetch all records with the same Version Covered
let query = await table.selectRecordsAsync({
    fields: ['Version Covered']
});

let recordsToDelete = [];

for (let record of query.records) {
    if (
        record.getCellValue('Version Covered') === versionCovered &&
        record.id !== newRecordId
    ) {
        recordsToDelete.push(record.id);
    }
}

// Airtable limits batch deletes to 50 at a time
while (recordsToDelete.length > 0) {
    await table.deleteRecordsAsync(recordsToDelete.slice(0, 50));
    recordsToDelete = recordsToDelete.slice(50);
}
