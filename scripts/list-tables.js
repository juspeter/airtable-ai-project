require('dotenv').config();
const axios = require('axios');

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

async function listTables() {
    console.log('🔍 Fetching tables from your Airtable base...\n');
    
    try {
        const response = await axios.get(
            `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            }
        );
        
        const tables = response.data.tables;
        console.log(`📋 Found ${tables.length} tables in your base:\n`);
        
        tables.forEach((table, index) => {
            console.log(`${index + 1}. ${table.name} (${table.id})`);
            console.log(`   Fields: ${table.fields.map(f => f.name).join(', ')}`);
            console.log(`   Primary field: ${table.primaryFieldId}\n`);
        });
        
        // Return table names for easy copying
        console.log('📝 To scan these tables, run:');
        console.log(`node scripts/base-scanner.js ${tables.map(t => `"${t.name}"`).join(' ')}`);
        
    } catch (error) {
        if (error.response && error.response.status === 403) {
            console.error('❌ Permission denied. Make sure your API token has the "schema.bases:read" scope.');
        } else {
            console.error('❌ Error fetching tables:', error.message);
        }
    }
}

listTables();