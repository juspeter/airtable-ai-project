require('dotenv').config();
const Airtable = require('airtable');

// Configuration
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

// Configure Airtable
Airtable.configure({
    apiKey: apiKey
});

const base = Airtable.base(baseId);

async function checkVersionReportView() {
    console.log('🔍 Checking "Version Report" view in Builds table...');
    console.log('');

    try {
        // Try to access the "Version Report" view specifically
        console.log('📊 Attempting to access "Version Report" view...');
        
        const versionReportRecords = await base('Builds').select({
            view: 'Version Report',
            maxRecords: 20, // Limit for testing
            fields: [
                'Release Version',
                'Build Status (Unified)',
                'Feature Complete Date',
                'Branch Create',
                'Branch Open', 
                'HL Date',
                'PD Date',
                'Cert Sub Date',
                'Live Date',
                'Next Version Live Date'
            ]
        }).all();

        console.log(`✅ Successfully accessed "Version Report" view!`);
        console.log(`📋 Found ${versionReportRecords.length} records in this view`);
        console.log('');

        console.log('🔍 Sample records from Version Report view:');
        console.log('-'.repeat(80));

        versionReportRecords.slice(0, 10).forEach((record, index) => {
            const releaseVersion = record.get('Release Version') || 'Unknown';
            const buildStatus = record.get('Build Status (Unified)') || 'Unknown';
            
            console.log(`\n📋 Record ${index + 1}: ${releaseVersion} [${buildStatus}]`);
            
            const milestoneFields = [
                'Feature Complete Date',
                'Branch Create',
                'Branch Open',
                'HL Date',
                'PD Date',
                'Cert Sub Date',
                'Live Date',
                'Next Version Live Date'
            ];

            let filledCount = 0;
            milestoneFields.forEach(field => {
                const value = record.get(field);
                const icon = value ? '✅' : '❌';
                const displayValue = value ? new Date(value).toISOString().split('T')[0] : 'EMPTY';
                console.log(`   ${icon} ${field}: ${displayValue}`);
                if (value) filledCount++;
            });
            
            const completeness = ((filledCount / milestoneFields.length) * 100).toFixed(1);
            console.log(`   📊 Completeness: ${filledCount}/${milestoneFields.length} (${completeness}%)`);
        });

        // Analyze the data quality in this view specifically
        console.log('\n' + '='.repeat(80));
        console.log('📊 VERSION REPORT VIEW ANALYSIS');
        console.log('='.repeat(80));

        let completeRecords = 0;
        let partialRecords = 0;
        let emptyRecords = 0;

        const fieldCompleteness = {};
        const milestoneFields = [
            'Feature Complete Date',
            'Branch Create', 
            'Branch Open',
            'HL Date',
            'PD Date',
            'Cert Sub Date',
            'Live Date',
            'Next Version Live Date'
        ];

        milestoneFields.forEach(field => {
            fieldCompleteness[field] = { filled: 0, total: versionReportRecords.length };
        });

        versionReportRecords.forEach(record => {
            let filledCount = 0;
            
            milestoneFields.forEach(field => {
                const value = record.get(field);
                if (value) {
                    filledCount++;
                    fieldCompleteness[field].filled++;
                }
            });

            if (filledCount === milestoneFields.length) {
                completeRecords++;
            } else if (filledCount > 0) {
                partialRecords++;
            } else {
                emptyRecords++;
            }
        });

        console.log(`\n📊 VERSION REPORT VIEW SUMMARY:`);
        console.log(`   Total records: ${versionReportRecords.length}`);
        console.log(`   ✅ Complete: ${completeRecords} (${((completeRecords / versionReportRecords.length) * 100).toFixed(1)}%)`);
        console.log(`   ⚠️  Partial: ${partialRecords} (${((partialRecords / versionReportRecords.length) * 100).toFixed(1)}%)`);
        console.log(`   ❌ Empty: ${emptyRecords} (${((emptyRecords / versionReportRecords.length) * 100).toFixed(1)}%)`);

        console.log(`\n📈 FIELD COMPLETENESS IN VERSION REPORT VIEW:`);
        milestoneFields.forEach(field => {
            const stats = fieldCompleteness[field];
            const percentage = ((stats.filled / stats.total) * 100).toFixed(1);
            const icon = percentage == 100 ? '✅' : percentage > 50 ? '⚠️' : '❌';
            console.log(`   ${icon} ${field}: ${stats.filled}/${stats.total} (${percentage}%)`);
        });

        const overallQuality = ((completeRecords / versionReportRecords.length) * 100).toFixed(1);
        console.log(`\n🎯 VERSION REPORT VIEW DATA QUALITY: ${overallQuality}%`);

        if (parseFloat(overallQuality) > 80) {
            console.log(`   🎉 EXCELLENT: This view has high-quality milestone data!`);
            console.log(`   💡 Recommendation: Use this view as the source for JIRA recipe troubleshooting`);
        } else if (parseFloat(overallQuality) > 50) {
            console.log(`   ⚠️  GOOD: This view has decent milestone data quality`);
            console.log(`   💡 Recommendation: Focus on records that are complete in this view`);
        } else {
            console.log(`   🔧 NEEDS IMPROVEMENT: This view also has data quality issues`);
            console.log(`   💡 Recommendation: Check if this view has specific filtering that excludes complete records`);
        }

    } catch (error) {
        console.error('❌ Error accessing "Version Report" view:', error.message);
        
        if (error.message.includes('INVALID_VIEW_NAME') || error.message.includes('NOT_FOUND')) {
            console.log('\n💡 The "Version Report" view might not exist or have a different name.');
            console.log('Let me try to access the default view and show available views...');
            
            try {
                // Try default view
                const defaultRecords = await base('Builds').select({
                    maxRecords: 5,
                    fields: ['Release Version', 'Build Status (Unified)']
                }).all();
                
                console.log(`✅ Successfully accessed default view with ${defaultRecords.length} sample records`);
                console.log('\n📋 Sample records from default view:');
                defaultRecords.forEach(record => {
                    const version = record.get('Release Version') || 'Unknown';
                    const status = record.get('Build Status (Unified)') || 'Unknown';
                    console.log(`   • ${version} [${status}]`);
                });

            } catch (defaultError) {
                console.error('❌ Error accessing default view:', defaultError.message);
            }
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Checking Airtable Views and Data Quality');
    console.log(`🔗 Base ID: ${baseId}`);
    console.log('');

    await checkVersionReportView();
}

// Run the checker
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { checkVersionReportView };