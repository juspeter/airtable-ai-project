require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
    console.error('❌ Error: Missing required environment variables');
    process.exit(1);
}

Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

async function quickScan() {
    console.log('🚀 Starting quick structure scan...\n');
    
    const structure = {
        baseId: baseId,
        scanDate: new Date().toISOString(),
        tables: []
    };

    // Key tables to scan
    const tablesToScan = [
        'Builds', 'Release Schedule', 'Integrations', 'Hotfixes', 
        'ShitHappens', 'RQA', 'Release Team', 'Open Issues'
    ];

    for (const tableName of tablesToScan) {
        console.log(`📋 Scanning structure of: ${tableName}`);
        
        try {
            // Get just 3 sample records to understand field structure
            const records = await base(tableName).select({
                maxRecords: 3,
                pageSize: 3
            }).firstPage();

            const fields = new Set();
            const fieldTypes = {};
            
            // Analyze field types from sample records
            records.forEach(record => {
                Object.entries(record.fields).forEach(([field, value]) => {
                    fields.add(field);
                    
                    // Detect field type
                    if (!fieldTypes[field]) {
                        if (Array.isArray(value)) {
                            fieldTypes[field] = 'array';
                        } else if (value && typeof value === 'object') {
                            fieldTypes[field] = 'object';
                        } else if (typeof value === 'number') {
                            fieldTypes[field] = 'number';
                        } else if (typeof value === 'boolean') {
                            fieldTypes[field] = 'boolean';
                        } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                            fieldTypes[field] = 'date';
                        } else {
                            fieldTypes[field] = 'string';
                        }
                    }
                });
            });

            structure.tables.push({
                name: tableName,
                fieldCount: fields.size,
                fields: Array.from(fields).map(f => ({
                    name: f,
                    type: fieldTypes[f] || 'unknown'
                })),
                sampleRecord: records[0] ? records[0].fields : {}
            });

            console.log(`   ✅ Found ${fields.size} fields\n`);
            
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}\n`);
            structure.tables.push({
                name: tableName,
                error: error.message
            });
        }
    }

    // Save results
    const outputFile = path.join(__dirname, '..', 'analysis', 'structure-scan.json');
    await fs.writeFile(outputFile, JSON.stringify(structure, null, 2));
    
    console.log(`\n✅ Structure scan complete! Saved to: analysis/structure-scan.json`);
    console.log('\n📊 Summary:');
    console.log(`Tables scanned: ${structure.tables.length}`);
    structure.tables.forEach(table => {
        if (!table.error) {
            console.log(`  - ${table.name}: ${table.fieldCount} fields`);
        } else {
            console.log(`  - ${table.name}: ERROR - ${table.error}`);
        }
    });
}

quickScan().catch(console.error);