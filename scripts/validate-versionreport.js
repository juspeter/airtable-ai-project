require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');

// Configure Airtable
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

class VersionReportValidator {
    constructor() {
        // Field mappings from versionreport.txt
        this.FIELDS = {
            // Build Table Fields
            BUILD_VERSION_UNIFIED: "Build Version (Unified)",
            BUILD_VERSION_SCHEDULED: "Build Version (Scheduled)",
            LABELS: "Status",
            DEPLOY_TYPE_DEPLOYS: "Deploy Type (Deploys)",
            DEPLOY_CLASSIFICATION: "Deploy Classification",
            LIVE_DATE_ACTUAL: "Start date",
            SUMMARY: "Summary",
            SEASON_UNIFIED: "Season (Unified)",
            MS_FEATURE_COMPLETE: "MS: Feature Complete",
            MS_BRANCH_CREATE: "MS: Branch Create",
            MS_BRANCH_OPEN: "MS: Branch Open",
            MS_DEV_COMPLETE: "MS: Dev Complete",
            MS_HARD_LOCK: "MS: Hard Lock",
            MS_PENCILS_DOWN: "MS: Pencil's Down",
            MS_CERT: "MS: Cert",
            MS_LIVE: "MS: Live",

            // Hotfix Table Fields
            PRIORITY: "Priority",
            COMPONENT_S: "Component/s",
            QA_STATE: "QA State",
            URGENCY_CUSTOM_FIELD: "Urgency",
            HOTFIX_CREATED_FIELD: "Created",
            HOTFIX_RESOLVED_FIELD: "Resolved",

            // Integration Table Fields
            HL_TO_PD_FLAG: "HL to PD Flag",
            PD_TO_CERT_SUB_FLAG: "PD to Cert Sub Flag",
            CERT_SUB_TO_LIVE_FLAG: "Cert Sub to Live Flag",
            LIVE_PLUS_FLAG: "Live+ Flag",
            INTEGRATION_AREA: "Integration Area",
            INTEGRATION_PLATFORM: "Integration Platform",
            INTEGRATION_FN_DOMAIN: "Integration FN Domain",
            INTEGRATION_CREATED_FIELD: "Created",
            INTEGRATION_RESOLVED_FIELD: "Resolved",
            INTEGRATION_REQUESTOR: "Integration Requestor",

            // ShitHappens (SH) Table Fields
            SH_LABELS: "Labels",
            SEVERITY_NORMALIZED: "Severity (Normalized)",
            SHITHAPPENS_ROOT_CAUSE: "Shithappens Root Cause",
            PRE_SH_FLAG: "Pre-SH Flag",
            SH_CREATED_FIELD: "Created",
            SH_RESOLVED_FIELD: "Resolved",

            // RQA Table Fields
            RQA_LABELS: "Labels",
            RQA_FIX_VERSION: "Fix Version/s",
            RQA_CREATED: "Created",
            RQA_RESOLVED: "Resolved"
        };

        this.tables = {
            builds: "Builds",
            hotfixes: "Hotfixes", 
            integrations: "Integrations",
            sh: "ShitHappens",
            rqa: "RQA",
            generatedReports: "Generated Reports"
        };

        this.validationResults = {
            tableAccess: {},
            fieldAccess: {},
            dataConsistency: {},
            recommendations: []
        };
    }

    // Test table access
    async validateTableAccess() {
        console.log('\n🔍 Validating table access...');
        
        for (const [key, tableName] of Object.entries(this.tables)) {
            try {
                const records = await base(tableName).select({
                    maxRecords: 1,
                    pageSize: 1
                }).firstPage();
                
                this.validationResults.tableAccess[tableName] = {
                    accessible: true,
                    recordCount: records.length > 0 ? "Has data" : "Empty or no access"
                };
                console.log(`✅ ${tableName}: Accessible`);
            } catch (error) {
                this.validationResults.tableAccess[tableName] = {
                    accessible: false,
                    error: error.message
                };
                console.log(`❌ ${tableName}: ${error.message}`);
            }
        }
    }

    // Test field access for critical fields
    async validateFieldAccess() {
        console.log('\n🔍 Validating field access...');
        
        const criticalFieldsByTable = {
            'Builds': [
                'Build Version (Unified)', 'Status', 'MS: Live', 'MS: Hard Lock',
                'MS: Pencil\'s Down', 'Deploy Classification'
            ],
            'Hotfixes': [
                'Build Version (Unified)', 'Priority', 'Urgency', 'QA State',
                'Created', 'Resolved'
            ],
            'Integrations': [
                'Build Version (Unified)', 'HL to PD Flag', 'PD to Cert Sub Flag',
                'Live+ Flag', 'Integration Area'
            ],
            'ShitHappens': [
                'Build Version (Unified)', 'Severity (Normalized)', 'Created',
                'Resolved', 'Pre-SH Flag'
            ],
            'RQA': [
                'Fix Version/s', 'Created', 'Resolved', 'Labels'
            ]
        };

        for (const [tableName, fields] of Object.entries(criticalFieldsByTable)) {
            if (!this.validationResults.tableAccess[tableName]?.accessible) {
                console.log(`⏭️ Skipping ${tableName} - table not accessible`);
                continue;
            }

            this.validationResults.fieldAccess[tableName] = {};
            
            try {
                const record = await base(tableName).select({
                    maxRecords: 1,
                    fields: fields
                }).firstPage();

                for (const field of fields) {
                    if (record.length > 0) {
                        try {
                            const value = record[0].get(field);
                            this.validationResults.fieldAccess[tableName][field] = {
                                accessible: true,
                                hasData: value !== null && value !== undefined
                            };
                            console.log(`✅ ${tableName}.${field}: Accessible`);
                        } catch (fieldError) {
                            this.validationResults.fieldAccess[tableName][field] = {
                                accessible: false,
                                error: fieldError.message
                            };
                            console.log(`❌ ${tableName}.${field}: ${fieldError.message}`);
                        }
                    }
                }
            } catch (error) {
                console.log(`❌ Error testing fields for ${tableName}: ${error.message}`);
            }
        }
    }

    // Test data consistency and logic
    async validateDataConsistency() {
        console.log('\n🔍 Validating data consistency...');
        
        try {
            // Test 1: Check if builds have consistent version formats
            const builds = await base('Builds').select({
                maxRecords: 10,
                fields: ['Build Version (Unified)', 'Status']
            }).firstPage();

            const versionFormats = builds.map(record => {
                const version = record.get('Build Version (Unified)');
                return {
                    version,
                    isNumericFormat: /^\d+\.\d+$/.test(version),
                    isHotfixFormat: /^\d+\.\d+\s+HF\d+$/.test(version)
                };
            });

            this.validationResults.dataConsistency.versionFormats = versionFormats;
            
            const validFormats = versionFormats.filter(v => v.isNumericFormat || v.isHotfixFormat);
            console.log(`✅ Version formats: ${validFormats.length}/${versionFormats.length} valid`);

            // Test 2: Check for expected build statuses
            const buildStatuses = [...new Set(builds.map(r => r.get('Status')))];
            console.log(`📊 Build statuses found: ${buildStatuses.join(', ')}`);

            // Test 3: Check integration flags logic
            const integrations = await base('Integrations').select({
                maxRecords: 10,
                fields: ['Build Version (Unified)', 'HL to PD Flag', 'PD to Cert Sub Flag', 'Live+ Flag']
            }).firstPage();

            const flagData = integrations.map(record => ({
                version: record.get('Build Version (Unified)'),
                hlToPd: record.get('HL to PD Flag'),
                pdToCert: record.get('PD to Cert Sub Flag'),
                livePlus: record.get('Live+ Flag')
            }));

            this.validationResults.dataConsistency.integrationFlags = flagData;
            console.log(`📊 Integration records analyzed: ${integrations.length}`);

        } catch (error) {
            console.log(`❌ Data consistency check failed: ${error.message}`);
            this.validationResults.dataConsistency.error = error.message;
        }
    }

    // Simulate versionreport.txt data fetching
    async simulateVersionReportFetch(targetVersion = "36.00") {
        console.log(`\n🔍 Simulating versionreport.txt fetch for version ${targetVersion}...`);
        
        try {
            // Simulate the main data fetch that versionreport.txt does
            const [buildsQuery, hotfixesQuery, integrationsQuery, shQuery, rqaQuery] = await Promise.all([
                base('Builds').select({
                    fields: [
                        'Build Version (Unified)', 'Status', 'Deploy Classification',
                        'MS: Live', 'MS: Hard Lock', 'MS: Pencil\'s Down'
                    ],
                    filterByFormula: `{Build Version (Unified)} = "${targetVersion}"`
                }).firstPage(),
                
                base('Hotfixes').select({
                    fields: [
                        'Build Version (Unified)', 'Priority', 'Urgency', 'QA State'
                    ],
                    filterByFormula: `{Build Version (Unified)} = "${targetVersion}"`
                }).firstPage(),
                
                base('Integrations').select({
                    fields: [
                        'Build Version (Unified)', 'HL to PD Flag', 'PD to Cert Sub Flag', 'Live+ Flag'
                    ],
                    filterByFormula: `{Build Version (Unified)} = "${targetVersion}"`
                }).firstPage(),
                
                base('ShitHappens').select({
                    fields: [
                        'Build Version (Unified)', 'Severity (Normalized)', 'Created'
                    ],
                    filterByFormula: `{Build Version (Unified)} = "${targetVersion}"`
                }).firstPage(),
                
                base('RQA').select({
                    fields: ['Fix Version/s', 'Created', 'Labels'],
                    maxRecords: 50
                }).firstPage()
            ]);

            const simulationResults = {
                targetVersion,
                builds: buildsQuery.length,
                hotfixes: hotfixesQuery.length,
                integrations: integrationsQuery.length,
                shitHappens: shQuery.length,
                rqa: rqaQuery.length,
                buildDetails: buildsQuery.map(r => ({
                    version: r.get('Build Version (Unified)'),
                    status: r.get('Status'),
                    deployType: r.get('Deploy Classification'),
                    liveDate: r.get('MS: Live')
                })),
                hotfixSummary: {
                    priorities: [...new Set(hotfixesQuery.map(r => r.get('Priority')))],
                    urgencies: [...new Set(hotfixesQuery.map(r => r.get('Urgency')))],
                    qaStates: [...new Set(hotfixesQuery.map(r => r.get('QA State')))]
                },
                integrationSummary: {
                    hlToPd: integrationsQuery.filter(r => r.get('HL to PD Flag') === 1).length,
                    pdToCert: integrationsQuery.filter(r => r.get('PD to Cert Sub Flag') === 1).length,
                    livePlus: integrationsQuery.filter(r => r.get('Live+ Flag') === 1).length
                }
            };

            console.log(`📊 Data found for ${targetVersion}:`);
            console.log(`   - Builds: ${simulationResults.builds}`);
            console.log(`   - Hotfixes: ${simulationResults.hotfixes}`);
            console.log(`   - Integrations: ${simulationResults.integrations}`);
            console.log(`   - ShitHappens: ${simulationResults.shitHappens}`);
            console.log(`   - RQA: ${simulationResults.rqa}`);

            this.validationResults.dataConsistency.simulation = simulationResults;
            return simulationResults;

        } catch (error) {
            console.log(`❌ Simulation failed: ${error.message}`);
            this.validationResults.dataConsistency.simulationError = error.message;
        }
    }

    // Generate recommendations
    generateRecommendations() {
        console.log('\n💡 Generating recommendations...');
        
        const recommendations = [];

        // Check for missing tables
        Object.entries(this.validationResults.tableAccess).forEach(([table, result]) => {
            if (!result.accessible) {
                recommendations.push({
                    type: 'error',
                    message: `Table "${table}" is not accessible. versionreport.txt will fail.`,
                    fix: 'Verify table name spelling and permissions'
                });
            }
        });

        // Check for missing fields
        Object.entries(this.validationResults.fieldAccess).forEach(([table, fields]) => {
            Object.entries(fields).forEach(([field, result]) => {
                if (!result.accessible) {
                    recommendations.push({
                        type: 'warning',
                        message: `Field "${field}" in table "${table}" is not accessible`,
                        fix: 'Check field name spelling or add field to table'
                    });
                }
            });
        });

        // Data quality recommendations
        if (this.validationResults.dataConsistency.simulation) {
            const sim = this.validationResults.dataConsistency.simulation;
            
            if (sim.builds === 0) {
                recommendations.push({
                    type: 'warning',
                    message: `No builds found for version ${sim.targetVersion}`,
                    fix: 'Verify version number format and data availability'
                });
            }

            if (sim.hotfixes === 0 && sim.integrations === 0) {
                recommendations.push({
                    type: 'info',
                    message: 'No hotfixes or integrations found - this may be normal for early releases'
                });
            }
        }

        this.validationResults.recommendations = recommendations;
        
        recommendations.forEach(rec => {
            const emoji = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`${emoji} ${rec.message}`);
            if (rec.fix) console.log(`   → Fix: ${rec.fix}`);
        });

        return recommendations;
    }

    // Save validation report
    async saveReport() {
        const outputPath = path.join(__dirname, '..', 'analysis', `versionreport-validation-${Date.now()}.json`);
        await fs.writeFile(outputPath, JSON.stringify(this.validationResults, null, 2));
        console.log(`\n✅ Validation report saved to: ${outputPath}`);
        return outputPath;
    }

    // Main validation workflow
    async runValidation(targetVersion = "36.00") {
        console.log('🚀 Starting versionreport.txt validation...');
        
        await this.validateTableAccess();
        await this.validateFieldAccess();
        await this.validateDataConsistency();
        await this.simulateVersionReportFetch(targetVersion);
        this.generateRecommendations();
        await this.saveReport();
        
        console.log('\n📊 Validation Summary:');
        console.log(`Tables accessible: ${Object.values(this.validationResults.tableAccess).filter(t => t.accessible).length}/6`);
        console.log(`Recommendations: ${this.validationResults.recommendations.length}`);
        
        return this.validationResults;
    }
}

// Main execution
async function main() {
    const validator = new VersionReportValidator();
    
    // Get target version from command line or use default
    const targetVersion = process.argv[2] || "36.00";
    
    await validator.runValidation(targetVersion);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { VersionReportValidator };