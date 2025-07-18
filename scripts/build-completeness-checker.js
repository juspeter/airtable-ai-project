require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

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
    'HL Date',
    'PD Date',
    'Cert Sub Date',
    'Live Date',
    'Next Version Live Date'
];

class BuildCompletenessChecker {
    constructor(base) {
        this.base = base;
    }

    async analyzeBuildCompleteness() {
        console.log('🔍 Analyzing Build Record Completeness...');
        console.log('');

        try {
            // Get all records with key identification fields
            const allRecords = await this.base('Builds').select({
                fields: ['Release Version', 'Build Status (Unified)', ...MILESTONE_FIELDS],
                sort: [{ field: 'Release Version', direction: 'desc' }]
            }).all();

            console.log(`✅ Analyzing ${allRecords.length} total build records`);
            console.log('');

            // Categorize builds
            const completeBuilds = [];
            const partialBuilds = [];
            const emptyBuilds = [];

            allRecords.forEach(record => {
                const releaseVersion = record.get('Release Version') || 'Unknown';
                const buildStatus = record.get('Build Status (Unified)') || 'Unknown';
                
                let filledFields = 0;
                const fieldStatus = {};

                MILESTONE_FIELDS.forEach(field => {
                    const value = record.get(field);
                    fieldStatus[field] = !!value;
                    if (value) filledFields++;
                });

                const buildInfo = {
                    releaseVersion,
                    buildStatus,
                    recordId: record.id,
                    filledFields,
                    totalFields: MILESTONE_FIELDS.length,
                    completeness: ((filledFields / MILESTONE_FIELDS.length) * 100).toFixed(1),
                    fieldStatus
                };

                if (filledFields === MILESTONE_FIELDS.length) {
                    completeBuilds.push(buildInfo);
                } else if (filledFields > 0) {
                    partialBuilds.push(buildInfo);
                } else {
                    emptyBuilds.push(buildInfo);
                }
            });

            // Sort by completeness
            partialBuilds.sort((a, b) => b.filledFields - a.filledFields);

            this.printCompletenessReport(completeBuilds, partialBuilds, emptyBuilds, allRecords.length);
            await this.saveCompletenessReport(completeBuilds, partialBuilds, emptyBuilds, allRecords.length);

        } catch (error) {
            console.error('❌ Error analyzing build completeness:', error.message);
        }
    }

    printCompletenessReport(completeBuilds, partialBuilds, emptyBuilds, totalRecords) {
        console.log('='.repeat(80));
        console.log('📊 BUILD COMPLETENESS REPORT');
        console.log('='.repeat(80));

        console.log(`\n📊 OVERVIEW:`);
        console.log(`   Total Builds: ${totalRecords}`);
        console.log(`   ✅ Complete Builds: ${completeBuilds.length} (${((completeBuilds.length / totalRecords) * 100).toFixed(1)}%)`);
        console.log(`   ⚠️  Partial Builds: ${partialBuilds.length} (${((partialBuilds.length / totalRecords) * 100).toFixed(1)}%)`);
        console.log(`   ❌ Empty Builds: ${emptyBuilds.length} (${((emptyBuilds.length / totalRecords) * 100).toFixed(1)}%)`);

        // Show complete builds (sample)
        if (completeBuilds.length > 0) {
            console.log(`\n✅ COMPLETE BUILDS (All ${MILESTONE_FIELDS.length} milestone fields populated):`);
            completeBuilds.slice(0, 10).forEach(build => {
                console.log(`   • ${build.releaseVersion} [${build.buildStatus}] - 100% complete`);
            });
            if (completeBuilds.length > 10) {
                console.log(`   ... and ${completeBuilds.length - 10} more complete builds`);
            }
        }

        // Show most complete partial builds
        if (partialBuilds.length > 0) {
            console.log(`\n⚠️  PARTIAL BUILDS (Missing some milestone data):`);
            console.log(`   Top 15 most complete builds:`);
            partialBuilds.slice(0, 15).forEach(build => {
                console.log(`   • ${build.releaseVersion} [${build.buildStatus}] - ${build.filledFields}/${build.totalFields} fields (${build.completeness}%)`);
            });

            if (partialBuilds.length > 15) {
                console.log(`   ... and ${partialBuilds.length - 15} more partial builds`);
            }

            // Show which fields are most commonly missing
            console.log(`\n   🔍 Most commonly missing fields in partial builds:`);
            const missingFieldCounts = {};
            MILESTONE_FIELDS.forEach(field => missingFieldCounts[field] = 0);

            partialBuilds.forEach(build => {
                MILESTONE_FIELDS.forEach(field => {
                    if (!build.fieldStatus[field]) {
                        missingFieldCounts[field]++;
                    }
                });
            });

            const sortedMissingFields = Object.entries(missingFieldCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            sortedMissingFields.forEach(([field, count]) => {
                const percentage = ((count / partialBuilds.length) * 100).toFixed(1);
                console.log(`      • ${field}: Missing in ${count}/${partialBuilds.length} partial builds (${percentage}%)`);
            });
        }

        // Show empty builds (sample)
        if (emptyBuilds.length > 0) {
            console.log(`\n❌ EMPTY BUILDS (No milestone data at all):`);
            emptyBuilds.slice(0, 10).forEach(build => {
                console.log(`   • ${build.releaseVersion} [${build.buildStatus}] - 0% complete`);
            });
            if (emptyBuilds.length > 10) {
                console.log(`   ... and ${emptyBuilds.length - 10} more empty builds`);
            }
        }

        // Pattern analysis
        console.log(`\n🔍 PATTERN ANALYSIS:`);
        
        // Check if newer builds are more complete
        const recentBuilds = [...completeBuilds, ...partialBuilds, ...emptyBuilds]
            .sort((a, b) => b.releaseVersion.localeCompare(a.releaseVersion))
            .slice(0, 50);

        const recentCompleteCount = recentBuilds.filter(b => b.completeness == 100).length;
        const recentPartialCount = recentBuilds.filter(b => b.completeness > 0 && b.completeness < 100).length;
        const recentEmptyCount = recentBuilds.filter(b => b.completeness == 0).length;

        console.log(`   Recent 50 builds breakdown:`);
        console.log(`   • Complete: ${recentCompleteCount}/50 (${((recentCompleteCount / 50) * 100).toFixed(1)}%)`);
        console.log(`   • Partial: ${recentPartialCount}/50 (${((recentPartialCount / 50) * 100).toFixed(1)}%)`);
        console.log(`   • Empty: ${recentEmptyCount}/50 (${((recentEmptyCount / 50) * 100).toFixed(1)}%)`);

        // Check build status patterns
        const statusPatterns = {};
        [...completeBuilds, ...partialBuilds, ...emptyBuilds].forEach(build => {
            const status = build.buildStatus;
            if (!statusPatterns[status]) {
                statusPatterns[status] = { complete: 0, partial: 0, empty: 0, total: 0 };
            }
            statusPatterns[status].total++;
            if (build.completeness == 100) statusPatterns[status].complete++;
            else if (build.completeness > 0) statusPatterns[status].partial++;
            else statusPatterns[status].empty++;
        });

        console.log(`\n   Build Status vs Completeness:`);
        Object.entries(statusPatterns)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8)
            .forEach(([status, counts]) => {
                const completePercent = ((counts.complete / counts.total) * 100).toFixed(1);
                console.log(`   • ${status}: ${counts.complete}/${counts.total} complete (${completePercent}%)`);
            });

        console.log(`\n🎯 KEY INSIGHTS:`);
        
        if (completeBuilds.length > 0) {
            console.log(`   ✅ ${completeBuilds.length} builds have complete milestone data`);
            console.log(`      → These can serve as templates for proper field mapping`);
        }
        
        if (partialBuilds.length > 0) {
            console.log(`   ⚠️  ${partialBuilds.length} builds have partial milestone data`);
            console.log(`      → Suggests selective data import or filtering issues`);
        }
        
        if (emptyBuilds.length > 0) {
            console.log(`   ❌ ${emptyBuilds.length} builds have no milestone data`);
            console.log(`      → Indicates data source or import process issues`);
        }

        const dataQualityScore = ((completeBuilds.length / totalRecords) * 100).toFixed(1);
        console.log(`\n📊 OVERALL DATA QUALITY SCORE: ${dataQualityScore}%`);
        
        if (parseFloat(dataQualityScore) > 80) {
            console.log(`   🎉 EXCELLENT: High data quality`);
        } else if (parseFloat(dataQualityScore) > 50) {
            console.log(`   ⚠️  GOOD: Decent data quality with room for improvement`);
        } else if (parseFloat(dataQualityScore) > 20) {
            console.log(`   🔧 FAIR: Significant data quality issues to address`);
        } else {
            console.log(`   🚨 POOR: Major data quality problems require immediate attention`);
        }
    }

    async saveCompletenessReport(completeBuilds, partialBuilds, emptyBuilds, totalRecords) {
        const reportData = {
            overview: {
                totalRecords,
                completeBuilds: completeBuilds.length,
                partialBuilds: partialBuilds.length,
                emptyBuilds: emptyBuilds.length,
                dataQualityScore: ((completeBuilds.length / totalRecords) * 100).toFixed(1)
            },
            completeBuilds: completeBuilds.slice(0, 50), // Limit for file size
            partialBuilds: partialBuilds.slice(0, 100),
            emptyBuilds: emptyBuilds.slice(0, 50),
            scanDate: new Date().toISOString()
        };

        const outputDir = path.join(__dirname, '..', 'analysis');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(outputDir, `build-completeness-${timestamp}.json`);

        try {
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputFile, JSON.stringify(reportData, null, 2));
            console.log(`\n💾 Completeness report saved to: ${outputFile}`);
        } catch (error) {
            console.error('❌ Error saving completeness report:', error.message);
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Build Completeness Analysis');
    console.log(`🔗 Base ID: ${baseId}`);
    console.log('');

    const checker = new BuildCompletenessChecker(base);
    await checker.analyzeBuildCompleteness();
}

// Run the checker
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { BuildCompletenessChecker };