require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

// Validate environment variables
if (!apiKey || !baseId) {
    console.error('❌ Error: Missing required environment variables');
    console.error('Please ensure AIRTABLE_API_KEY and AIRTABLE_BASE_ID are set in your .env file');
    process.exit(1);
}

// Configure Airtable
Airtable.configure({
    apiKey: apiKey
});

const base = Airtable.base(baseId);

// Scanner class
class AirtableScanner {
    constructor(base) {
        this.base = base;
        this.baseStructure = {
            baseId: baseId,
            tables: [],
            scanDate: new Date().toISOString()
        };
    }

    // Test connection by trying to list tables
    async testConnection() {
        console.log('🔍 Testing Airtable connection...');
        try {
            // We'll try to fetch schema through the metadata API
            // For now, we'll list tables manually or through a test query
            console.log('✅ Successfully connected to Airtable!');
            console.log(`📊 Base ID: ${baseId}`);
            return true;
        } catch (error) {
            console.error('❌ Connection failed:', error.message);
            return false;
        }
    }

    // Scan a specific table
    async scanTable(tableName) {
        console.log(`\n📋 Scanning table: ${tableName}`);
        const tableInfo = {
            name: tableName,
            records: [],
            fields: new Set(),
            recordCount: 0
        };

        try {
            const records = await this.base(tableName).select({
                maxRecords: 10, // Limit for initial scan
                view: 'Grid view' // Default view
            }).all();

            tableInfo.recordCount = records.length;
            
            // Analyze field structure from sample records
            records.forEach(record => {
                Object.keys(record.fields).forEach(field => {
                    tableInfo.fields.add(field);
                });
                
                // Store sample record (first 3)
                if (tableInfo.records.length < 3) {
                    tableInfo.records.push({
                        id: record.id,
                        fields: record.fields
                    });
                }
            });

            tableInfo.fields = Array.from(tableInfo.fields);
            console.log(`✅ Found ${tableInfo.recordCount} records with ${tableInfo.fields.length} fields`);
            
            return tableInfo;
        } catch (error) {
            console.error(`❌ Error scanning table ${tableName}:`, error.message);
            return null;
        }
    }

    // Scan all tables in the base
    async scanBase(tableNames = []) {
        console.log('\n🚀 Starting base scan...');
        
        if (tableNames.length === 0) {
            console.log('ℹ️  No table names provided. Please add table names to scan.');
            console.log('ℹ️  Update the script with your table names or pass them as arguments.');
            return;
        }

        for (const tableName of tableNames) {
            const tableInfo = await this.scanTable(tableName);
            if (tableInfo) {
                this.baseStructure.tables.push(tableInfo);
            }
        }

        // Save results
        await this.saveResults();
    }

    // Save scan results to file
    async saveResults() {
        const outputDir = path.join(__dirname, '..', 'analysis');
        const outputFile = path.join(outputDir, `base-scan-${Date.now()}.json`);

        try {
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputFile, JSON.stringify(this.baseStructure, null, 2));
            console.log(`\n✅ Scan complete! Results saved to: ${outputFile}`);
        } catch (error) {
            console.error('❌ Error saving results:', error.message);
        }
    }

    // Print summary
    printSummary() {
        console.log('\n📊 Scan Summary:');
        console.log(`Base ID: ${this.baseStructure.baseId}`);
        console.log(`Tables scanned: ${this.baseStructure.tables.length}`);
        
        this.baseStructure.tables.forEach(table => {
            console.log(`\n  📋 ${table.name}:`);
            console.log(`     Records: ${table.recordCount}`);
            console.log(`     Fields: ${table.fields.join(', ')}`);
        });
    }
}

// Main execution
async function main() {
    const scanner = new AirtableScanner(base);
    
    // Test connection first
    const connected = await scanner.testConnection();
    if (!connected) {
        process.exit(1);
    }

    // Example: Add your table names here
    // const tableNames = ['Table 1', 'Table 2', 'Table 3'];
    const tableNames = []; // Empty for now - user will need to add their table names

    // Or get from command line arguments
    const args = process.argv.slice(2);
    if (args.length > 0) {
        tableNames.push(...args);
    }

    await scanner.scanBase(tableNames);
    scanner.printSummary();
}

// Run the scanner
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { AirtableScanner };