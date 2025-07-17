require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');

// Configure Airtable
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

class AIAnalysisFramework {
    constructor() {
        this.analysisResults = {
            timestamp: new Date().toISOString(),
            analyses: {}
        };
    }

    // Fetch data from Airtable with intelligent sampling
    async fetchTableData(tableName, options = {}) {
        const { maxRecords = 100, fields = [], filter = null } = options;
        console.log(`📊 Fetching data from ${tableName}...`);
        
        try {
            const queryOptions = {
                maxRecords,
                ...(fields.length > 0 && { fields }),
                ...(filter && { filterByFormula: filter })
            };
            
            const records = await base(tableName).select(queryOptions).all();
            console.log(`✅ Fetched ${records.length} records from ${tableName}`);
            
            return records.map(record => ({
                id: record.id,
                fields: record.fields
            }));
        } catch (error) {
            console.error(`❌ Error fetching ${tableName}:`, error.message);
            return [];
        }
    }

    // Analyze release health patterns
    async analyzeReleaseHealth() {
        console.log('\n🔍 Analyzing Release Health Patterns...');
        
        const builds = await this.fetchTableData('Builds', {
            maxRecords: 50,
            fields: [
                'Release Version', 'Build Status (Unified)', 'Release Health Score',
                'Total Hotfixes', 'Total Integrations', 'SH Score', 'Deploy Fallout Score',
                'Live Date', 'PD Date', 'HL Date', 'Release Cycle Duration'
            ]
        });

        const analysis = {
            totalBuilds: builds.length,
            averageHealthScore: 0,
            healthTrends: [],
            riskFactors: [],
            recommendations: []
        };

        // Calculate metrics
        const healthScores = builds
            .map(b => b.fields['Release Health Score'])
            .filter(score => score !== undefined);
        
        if (healthScores.length > 0) {
            analysis.averageHealthScore = (healthScores.reduce((a, b) => a + b, 0) / healthScores.length).toFixed(2);
        }

        // Identify patterns
        builds.forEach(build => {
            const hotfixes = build.fields['Total Hotfixes'] || 0;
            const integrations = build.fields['Total Integrations'] || 0;
            const shScore = build.fields['SH Score'] || 0;
            
            // High risk indicators
            if (hotfixes > 5) {
                analysis.riskFactors.push({
                    version: build.fields['Release Version'],
                    factor: 'High hotfix count',
                    value: hotfixes,
                    severity: 'high'
                });
            }
            
            if (shScore > 10) {
                analysis.riskFactors.push({
                    version: build.fields['Release Version'],
                    factor: 'High incident score',
                    value: shScore,
                    severity: 'critical'
                });
            }
        });

        // Generate AI-style recommendations
        if (analysis.averageHealthScore < 70) {
            analysis.recommendations.push('Consider implementing more thorough pre-release testing');
        }
        
        if (analysis.riskFactors.filter(r => r.severity === 'critical').length > 2) {
            analysis.recommendations.push('Critical pattern detected: Multiple releases with high incident scores');
        }

        this.analysisResults.analyses.releaseHealth = analysis;
        return analysis;
    }

    // Analyze incident patterns
    async analyzeIncidentPatterns() {
        console.log('\n🔍 Analyzing Incident Patterns...');
        
        const incidents = await this.fetchTableData('ShitHappens', {
            maxRecords: 100,
            fields: [
                'Summary', 'Severity (Normalized)', 'Component/s', 'Root Cause',
                'Created', 'Resolved', 'Build Version (Unified)'
            ]
        });

        const analysis = {
            totalIncidents: incidents.length,
            severityDistribution: {},
            componentHotspots: {},
            rootCausePatterns: {},
            timeToResolve: [],
            insights: []
        };

        // Analyze severity distribution
        incidents.forEach(incident => {
            const severity = incident.fields['Severity (Normalized)'] || 'Unknown';
            analysis.severityDistribution[severity] = (analysis.severityDistribution[severity] || 0) + 1;
            
            // Component analysis
            const components = incident.fields['Component/s'] || [];
            components.forEach(comp => {
                analysis.componentHotspots[comp] = (analysis.componentHotspots[comp] || 0) + 1;
            });
            
            // Root cause patterns
            const rootCause = incident.fields['Root Cause'] || 'Unspecified';
            analysis.rootCausePatterns[rootCause] = (analysis.rootCausePatterns[rootCause] || 0) + 1;
            
            // Resolution time
            if (incident.fields['Created'] && incident.fields['Resolved']) {
                const created = new Date(incident.fields['Created']);
                const resolved = new Date(incident.fields['Resolved']);
                const hoursToResolve = (resolved - created) / (1000 * 60 * 60);
                analysis.timeToResolve.push(hoursToResolve);
            }
        });

        // Generate insights
        const topComponent = Object.entries(analysis.componentHotspots)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (topComponent) {
            analysis.insights.push(`Component "${topComponent[0]}" has the most incidents (${topComponent[1]})`);
        }

        const avgResolutionTime = analysis.timeToResolve.length > 0
            ? (analysis.timeToResolve.reduce((a, b) => a + b, 0) / analysis.timeToResolve.length).toFixed(1)
            : 0;
        
        analysis.insights.push(`Average incident resolution time: ${avgResolutionTime} hours`);

        this.analysisResults.analyses.incidentPatterns = analysis;
        return analysis;
    }

    // Predict release risks using pattern analysis
    async predictReleaseRisks() {
        console.log('\n🔮 Predicting Release Risks...');
        
        const integrations = await this.fetchTableData('Integrations', {
            maxRecords: 200,
            fields: ['Build Version (Unified)', 'Status', 'Priority', 'Created', 'Resolved']
        });

        const hotfixes = await this.fetchTableData('Hotfixes', {
            maxRecords: 100,
            fields: ['Build Version (Unified)', 'Severity', 'Priority', 'Created']
        });

        const predictions = {
            upcomingReleaseRisk: {},
            patterns: [],
            recommendations: []
        };

        // Group by build version
        const buildMetrics = {};
        
        integrations.forEach(integration => {
            const version = integration.fields['Build Version (Unified)'];
            if (!buildMetrics[version]) {
                buildMetrics[version] = { integrations: 0, hotfixes: 0, issues: 0 };
            }
            buildMetrics[version].integrations++;
        });

        hotfixes.forEach(hotfix => {
            const version = hotfix.fields['Build Version (Unified)'];
            if (!buildMetrics[version]) {
                buildMetrics[version] = { integrations: 0, hotfixes: 0, issues: 0 };
            }
            buildMetrics[version].hotfixes++;
            if (hotfix.fields['Severity'] === 'Critical') {
                buildMetrics[version].issues++;
            }
        });

        // Calculate risk scores
        Object.entries(buildMetrics).forEach(([version, metrics]) => {
            const riskScore = (metrics.integrations * 0.3) + (metrics.hotfixes * 0.5) + (metrics.issues * 0.2);
            predictions.upcomingReleaseRisk[version] = {
                score: riskScore.toFixed(2),
                level: riskScore > 10 ? 'high' : riskScore > 5 ? 'medium' : 'low',
                metrics
            };
        });

        // Pattern detection
        if (Object.values(buildMetrics).filter(m => m.hotfixes > 3).length > 2) {
            predictions.patterns.push('Multiple releases showing high hotfix counts - consider extending QA cycles');
        }

        this.analysisResults.analyses.riskPredictions = predictions;
        return predictions;
    }

    // Generate comprehensive AI insights report
    async generateInsightsReport() {
        console.log('\n📝 Generating AI Insights Report...');
        
        await this.analyzeReleaseHealth();
        await this.analyzeIncidentPatterns();
        await this.predictReleaseRisks();

        // Create executive summary
        const summary = {
            reportDate: new Date().toISOString(),
            keyFindings: [],
            actionItems: [],
            metrics: {}
        };

        // Compile key findings
        if (this.analysisResults.analyses.releaseHealth.averageHealthScore < 75) {
            summary.keyFindings.push('Release health is below optimal levels');
        }

        if (this.analysisResults.analyses.incidentPatterns.insights.length > 0) {
            summary.keyFindings.push(...this.analysisResults.analyses.incidentPatterns.insights);
        }

        // Compile action items
        summary.actionItems = [
            ...this.analysisResults.analyses.releaseHealth.recommendations,
            ...this.analysisResults.analyses.riskPredictions.patterns
        ];

        this.analysisResults.executiveSummary = summary;

        // Save report
        const reportPath = path.join(__dirname, '..', 'analysis', `ai-insights-${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(this.analysisResults, null, 2));
        
        console.log(`\n✅ AI Insights Report saved to: ${reportPath}`);
        return this.analysisResults;
    }
}

// Run analysis
async function main() {
    const analyzer = new AIAnalysisFramework();
    const report = await analyzer.generateInsightsReport();
    
    console.log('\n🎯 Executive Summary:');
    console.log('Key Findings:', report.executiveSummary.keyFindings);
    console.log('Action Items:', report.executiveSummary.actionItems);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { AIAnalysisFramework };