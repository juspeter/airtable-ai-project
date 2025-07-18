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

// Milestone date fields to check
const MILESTONE_FIELDS = [
    'Feature Complete Date',
    'Branch Create',
    'Branch Open',
    'HL Date',           // Hard Lock Date
    'PD Date',           // Pencils Down Date
    'Cert Sub Date',     // Certification Submission Date
    'Live Date',
    'Next Version Live Date'
];

class MilestoneDateChecker {
    constructor(base) {
        this.base = base;
        this.results = {
            baseId: baseId,
            tableName: 'Builds',
            scanDate: new Date().toISOString(),
            totalRecords: 0,
            fieldAnalysis: {},
            sampleRecords: [],
            summary: {}
        };
    }

    async checkBuildsTable() {
        console.log('🔍 Checking Builds table milestone date fields...');
        console.log(`📋 Target fields: ${MILESTONE_FIELDS.join(', ')}`);
        console.log('');

        try {
            // First, get all records to understand the full scope
            console.log('📊 Fetching all records from Builds table...');
            const allRecords = await this.base('Builds').select({
                // Get all records but only the fields we care about plus Release Version for identification
                fields: ['Release Version', ...MILESTONE_FIELDS],
                sort: [{ field: 'Release Version', direction: 'desc' }]
            }).all();

            this.results.totalRecords = allRecords.length;
            console.log(`✅ Found ${allRecords.length} total records in Builds table`);
            console.log('');

            // Initialize field analysis
            MILESTONE_FIELDS.forEach(field => {
                this.results.fieldAnalysis[field] = {
                    totalRecords: allRecords.length,
                    recordsWithData: 0,
                    recordsEmpty: 0,
                    percentageComplete: 0,
                    sampleValues: []
                };
            });

            // Analyze each record
            console.log('🔬 Analyzing milestone date field completeness...');
            allRecords.forEach((record, index) => {
                const releaseVersion = record.get('Release Version') || `Record ${index + 1}`;
                
                // Store first 10 records as samples
                if (index < 10) {
                    const sampleRecord = {
                        releaseVersion: releaseVersion,
                        recordId: record.id,
                        milestoneFields: {}
                    };

                    MILESTONE_FIELDS.forEach(field => {
                        const value = record.get(field);
                        sampleRecord.milestoneFields[field] = value || null;
                    });

                    this.results.sampleRecords.push(sampleRecord);
                }

                // Analyze each milestone field
                MILESTONE_FIELDS.forEach(field => {
                    const value = record.get(field);
                    const fieldStats = this.results.fieldAnalysis[field];

                    if (value) {
                        fieldStats.recordsWithData++;
                        // Store sample values (first 5 unique ones)
                        if (fieldStats.sampleValues.length < 5) {
                            const sampleValue = {
                                releaseVersion: releaseVersion,
                                value: value,
                                type: typeof value
                            };
                            fieldStats.sampleValues.push(sampleValue);
                        }
                    } else {
                        fieldStats.recordsEmpty++;
                    }
                });
            });

            // Calculate percentages
            MILESTONE_FIELDS.forEach(field => {
                const stats = this.results.fieldAnalysis[field];
                stats.percentageComplete = ((stats.recordsWithData / stats.totalRecords) * 100).toFixed(1);
            });

            // Generate summary
            this.generateSummary();
            this.printAnalysis();
            await this.saveResults();

        } catch (error) {
            console.error('❌ Error analyzing Builds table:', error.message);
            if (error.message.includes('NOT_FOUND')) {
                console.error('💡 Hint: The table name might be different. Try checking the exact table name in your Airtable base.');
            }
            if (error.message.includes('INVALID_FIELD_NAME')) {
                console.error('💡 Hint: One or more field names might be different. Check the exact field names in your Builds table.');
            }
        }
    }

    generateSummary() {
        const summary = {
            completeFields: [],
            partialFields: [],
            emptyFields: [],
            mostComplete: null,
            leastComplete: null
        };

        let highestPercentage = -1;
        let lowestPercentage = 101;

        MILESTONE_FIELDS.forEach(field => {
            const stats = this.results.fieldAnalysis[field];
            const percentage = parseFloat(stats.percentageComplete);

            if (percentage === 100) {
                summary.completeFields.push(field);
            } else if (percentage > 0) {
                summary.partialFields.push(field);
            } else {
                summary.emptyFields.push(field);
            }

            if (percentage > highestPercentage) {
                highestPercentage = percentage;
                summary.mostComplete = { field, percentage };
            }

            if (percentage < lowestPercentage) {
                lowestPercentage = percentage;
                summary.leastComplete = { field, percentage };
            }
        });

        this.results.summary = summary;
    }

    printAnalysis() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 MILESTONE DATE FIELDS ANALYSIS REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n📋 Table: Builds`);
        console.log(`📊 Total Records: ${this.results.totalRecords}`);
        console.log(`🗓️  Scan Date: ${this.results.scanDate}`);

        console.log('\n' + '-'.repeat(80));
        console.log('📈 FIELD COMPLETENESS ANALYSIS');
        console.log('-'.repeat(80));

        // Sort fields by completeness percentage
        const sortedFields = MILESTONE_FIELDS.sort((a, b) => {
            return parseFloat(this.results.fieldAnalysis[b].percentageComplete) - 
                   parseFloat(this.results.fieldAnalysis[a].percentageComplete);
        });

        sortedFields.forEach(field => {
            const stats = this.results.fieldAnalysis[field];
            const percentage = stats.percentageComplete;
            const statusIcon = percentage == 100 ? '✅' : percentage > 50 ? '⚠️' : '❌';
            
            console.log(`\n${statusIcon} ${field}:`);
            console.log(`   📊 ${stats.recordsWithData}/${stats.totalRecords} records have data (${percentage}%)`);
            console.log(`   🕳️  ${stats.recordsEmpty} records are empty`);
            
            if (stats.sampleValues.length > 0) {
                console.log(`   📋 Sample values:`);
                stats.sampleValues.forEach(sample => {
                    console.log(`      • ${sample.releaseVersion}: ${sample.value} (${sample.type})`);
                });
            }
        });

        console.log('\n' + '-'.repeat(80));
        console.log('📊 SUMMARY');
        console.log('-'.repeat(80));

        const summary = this.results.summary;
        
        if (summary.completeFields.length > 0) {
            console.log(`\n✅ COMPLETE FIELDS (100% populated):`);
            summary.completeFields.forEach(field => console.log(`   • ${field}`));
        }

        if (summary.partialFields.length > 0) {
            console.log(`\n⚠️  PARTIAL FIELDS (some data missing):`);
            summary.partialFields.forEach(field => {
                const percentage = this.results.fieldAnalysis[field].percentageComplete;
                console.log(`   • ${field} (${percentage}%)`);
            });
        }

        if (summary.emptyFields.length > 0) {
            console.log(`\n❌ EMPTY FIELDS (no data):`);
            summary.emptyFields.forEach(field => console.log(`   • ${field}`));
        }

        if (summary.mostComplete) {
            console.log(`\n🏆 Most Complete: ${summary.mostComplete.field} (${summary.mostComplete.percentage}%)`);
        }
        
        if (summary.leastComplete) {
            console.log(`💔 Least Complete: ${summary.leastComplete.field} (${summary.leastComplete.percentage}%)`);
        }

        console.log('\n' + '-'.repeat(80));
        console.log('🔍 SAMPLE RECORDS');
        console.log('-'.repeat(80));

        this.results.sampleRecords.slice(0, 5).forEach((record, index) => {
            console.log(`\n📋 Sample Record ${index + 1}: ${record.releaseVersion}`);
            MILESTONE_FIELDS.forEach(field => {
                const value = record.milestoneFields[field];
                const icon = value ? '✅' : '❌';
                console.log(`   ${icon} ${field}: ${value || 'EMPTY'}`);
            });
        });

        console.log('\n' + '='.repeat(80));
        console.log('🎯 DIAGNOSIS & RECOMMENDATIONS');
        console.log('='.repeat(80));

        const totalEmptyFields = summary.emptyFields.length;
        const totalPartialFields = summary.partialFields.length;
        const totalCompleteFields = summary.completeFields.length;

        if (totalCompleteFields === MILESTONE_FIELDS.length) {
            console.log('\n🎉 EXCELLENT: All milestone date fields are fully populated!');
            console.log('   The issue is likely in the JIRA recipe field mapping, not missing data.');
        } else if (totalEmptyFields === MILESTONE_FIELDS.length) {
            console.log('\n🚨 CRITICAL: All milestone date fields are empty!');
            console.log('   This suggests a fundamental data import or field naming issue.');
        } else {
            console.log('\n⚠️  MIXED RESULTS: Some fields have data, others don\'t.');
            console.log('   This could indicate:');
            console.log('   • Inconsistent data entry processes');
            console.log('   • Field mapping issues in integration recipes');
            console.log('   • Different field names in source vs destination');
        }

        console.log('\n🔧 RECOMMENDED ACTIONS:');
        if (totalEmptyFields > 0) {
            console.log('   1. ✅ Verify field names in Airtable match those in JIRA recipe');
            console.log('   2. ✅ Check if data exists in source system (JIRA/other)');
            console.log('   3. ✅ Review Workato recipe field mappings');
        }
        if (totalPartialFields > 0) {
            console.log('   4. ✅ Investigate why some records have data and others don\'t');
            console.log('   5. ✅ Check for filtering or conditional logic in recipes');
        }
        if (totalCompleteFields > 0) {
            console.log('   6. ✅ Use working fields as reference for troubleshooting');
        }

        console.log('\n📁 Detailed analysis saved to file for further investigation.');
    }

    async saveResults() {
        const outputDir = path.join(__dirname, '..', 'analysis');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(outputDir, `milestone-date-analysis-${timestamp}.json`);

        try {
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputFile, JSON.stringify(this.results, null, 2));
            console.log(`\n💾 Analysis saved to: ${outputFile}`);
        } catch (error) {
            console.error('❌ Error saving analysis:', error.message);
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Milestone Date Fields Analysis');
    console.log(`🔗 Base ID: ${baseId}`);
    console.log('');

    const checker = new MilestoneDateChecker(base);
    await checker.checkBuildsTable();
}

// Run the checker
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { MilestoneDateChecker };