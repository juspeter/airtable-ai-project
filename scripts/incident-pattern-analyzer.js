require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

class IncidentPatternAnalyzer {
    constructor() {
        this.incidents = [];
        this.patterns = {};
        this.insights = [];
    }

    // Fetch incident data from multiple tables
    async fetchIncidentData() {
        console.log('🔍 Fetching incident data from multiple sources...');

        // Fetch from ShitHappens table
        const shIncidents = await base('ShitHappens').select({
            maxRecords: 300,
            fields: [
                'Issue Key', 'Summary', 'Description', 'Created', 'Resolved',
                'Severity (Normalized)', 'Component/s', 'Root Cause', 'Captain',
                'Build Version (Unified)', 'SH Score', 'Labels'
            ]
        }).all();

        // Fetch from Hotfixes table
        const hotfixes = await base('Hotfixes').select({
            maxRecords: 200,
            fields: [
                'Issue Key', 'Summary', 'Description', 'Created', 'Resolved',
                'Severity', 'Priority', 'Component/s', 'Build Version (Unified)',
                'Urgency', 'Action Type'
            ]
        }).all();

        // Combine and normalize data
        this.incidents = [
            ...shIncidents.map(record => ({
                source: 'ShitHappens',
                key: record.fields['Issue Key'],
                summary: record.fields['Summary'],
                description: record.fields['Description'],
                created: record.fields['Created'],
                resolved: record.fields['Resolved'],
                severity: record.fields['Severity (Normalized)'],
                components: record.fields['Component/s'] || [],
                rootCause: record.fields['Root Cause'],
                version: record.fields['Build Version (Unified)'],
                score: record.fields['SH Score']
            })),
            ...hotfixes.map(record => ({
                source: 'Hotfixes',
                key: record.fields['Issue Key'],
                summary: record.fields['Summary'],
                description: record.fields['Description'],
                created: record.fields['Created'],
                resolved: record.fields['Resolved'],
                severity: record.fields['Severity'],
                components: record.fields['Component/s'] || [],
                version: record.fields['Build Version (Unified)'],
                urgency: record.fields['Urgency'],
                actionType: record.fields['Action Type']
            }))
        ];

        console.log(`✅ Loaded ${this.incidents.length} incidents for analysis`);
        return this.incidents;
    }

    // Analyze temporal patterns
    analyzeTemporalPatterns() {
        console.log('\n⏰ Analyzing temporal patterns...');
        
        const patterns = {
            hourlyDistribution: {},
            dayOfWeekDistribution: {},
            monthlyTrends: {},
            timeToResolution: {
                bySeverity: {},
                byComponent: {}
            }
        };

        this.incidents.forEach(incident => {
            if (incident.created) {
                const date = new Date(incident.created);
                const hour = date.getHours();
                const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
                const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                // Hour distribution
                patterns.hourlyDistribution[hour] = (patterns.hourlyDistribution[hour] || 0) + 1;
                
                // Day of week distribution
                patterns.dayOfWeekDistribution[dayOfWeek] = (patterns.dayOfWeekDistribution[dayOfWeek] || 0) + 1;
                
                // Monthly trends
                patterns.monthlyTrends[monthYear] = (patterns.monthlyTrends[monthYear] || 0) + 1;

                // Resolution time analysis
                if (incident.resolved) {
                    const resolutionTime = (new Date(incident.resolved) - date) / (1000 * 60 * 60); // hours
                    const severity = incident.severity || 'Unknown';
                    
                    if (!patterns.timeToResolution.bySeverity[severity]) {
                        patterns.timeToResolution.bySeverity[severity] = [];
                    }
                    patterns.timeToResolution.bySeverity[severity].push(resolutionTime);
                }
            }
        });

        // Calculate averages
        Object.keys(patterns.timeToResolution.bySeverity).forEach(severity => {
            const times = patterns.timeToResolution.bySeverity[severity];
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            patterns.timeToResolution.bySeverity[severity] = {
                average: avg.toFixed(2),
                count: times.length
            };
        });

        this.patterns.temporal = patterns;
        return patterns;
    }

    // Analyze component patterns
    analyzeComponentPatterns() {
        console.log('\n🔧 Analyzing component patterns...');
        
        const componentAnalysis = {
            incidentsByComponent: {},
            severityByComponent: {},
            correlations: []
        };

        this.incidents.forEach(incident => {
            const components = incident.components || [];
            components.forEach(component => {
                // Count incidents per component
                if (!componentAnalysis.incidentsByComponent[component]) {
                    componentAnalysis.incidentsByComponent[component] = {
                        count: 0,
                        severities: {},
                        versions: new Set()
                    };
                }
                
                const compData = componentAnalysis.incidentsByComponent[component];
                compData.count++;
                compData.severities[incident.severity || 'Unknown'] = 
                    (compData.severities[incident.severity || 'Unknown'] || 0) + 1;
                
                if (incident.version) {
                    compData.versions.add(incident.version);
                }
            });
        });

        // Find component correlations
        const componentList = Object.keys(componentAnalysis.incidentsByComponent);
        componentList.forEach((comp1, i) => {
            componentList.slice(i + 1).forEach(comp2 => {
                const coOccurrences = this.incidents.filter(inc => 
                    inc.components.includes(comp1) && inc.components.includes(comp2)
                ).length;
                
                if (coOccurrences > 5) {
                    componentAnalysis.correlations.push({
                        components: [comp1, comp2],
                        occurrences: coOccurrences
                    });
                }
            });
        });

        this.patterns.components = componentAnalysis;
        return componentAnalysis;
    }

    // Detect anomalies and generate alerts
    detectAnomalies() {
        console.log('\n⚠️ Detecting anomalies...');
        
        const anomalies = {
            suddenSpikes: [],
            unusualPatterns: [],
            criticalComponents: []
        };

        // Detect sudden spikes in incidents
        const monthlyData = Object.entries(this.patterns.temporal.monthlyTrends);
        for (let i = 1; i < monthlyData.length; i++) {
            const prevMonth = monthlyData[i - 1][1];
            const currMonth = monthlyData[i][1];
            
            if (currMonth > prevMonth * 2) {
                anomalies.suddenSpikes.push({
                    month: monthlyData[i][0],
                    increase: `${((currMonth / prevMonth - 1) * 100).toFixed(0)}%`,
                    count: currMonth
                });
            }
        }

        // Identify critical components
        Object.entries(this.patterns.components.incidentsByComponent).forEach(([component, data]) => {
            const criticalCount = data.severities['Critical'] || 0;
            const totalCount = data.count;
            
            if (criticalCount > 5 || (criticalCount / totalCount) > 0.3) {
                anomalies.criticalComponents.push({
                    component,
                    criticalIncidents: criticalCount,
                    totalIncidents: totalCount,
                    criticalRate: `${((criticalCount / totalCount) * 100).toFixed(0)}%`
                });
            }
        });

        this.patterns.anomalies = anomalies;
        return anomalies;
    }

    // Generate predictive insights
    generatePredictiveInsights() {
        console.log('\n💡 Generating predictive insights...');
        
        this.insights = [];

        // Time-based insights
        const peakHour = Object.entries(this.patterns.temporal.hourlyDistribution)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (peakHour) {
            this.insights.push({
                type: 'temporal',
                severity: 'info',
                message: `Most incidents occur at ${peakHour[0]}:00 hours (${peakHour[1]} incidents)`,
                recommendation: 'Schedule critical deployments outside this time window'
            });
        }

        // Component insights
        const problematicComponents = Object.entries(this.patterns.components.incidentsByComponent)
            .filter(([_, data]) => data.count > 10)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3);

        problematicComponents.forEach(([component, data]) => {
            this.insights.push({
                type: 'component',
                severity: 'warning',
                message: `Component "${component}" has ${data.count} incidents across ${data.versions.size} versions`,
                recommendation: `Consider refactoring or additional testing for ${component}`
            });
        });

        // Anomaly insights
        if (this.patterns.anomalies.suddenSpikes.length > 0) {
            const latestSpike = this.patterns.anomalies.suddenSpikes[this.patterns.anomalies.suddenSpikes.length - 1];
            this.insights.push({
                type: 'anomaly',
                severity: 'critical',
                message: `Incident spike detected in ${latestSpike.month}: ${latestSpike.increase} increase`,
                recommendation: 'Investigate root causes and implement preventive measures'
            });
        }

        // Resolution time insights
        const severityResolution = this.patterns.temporal.timeToResolution.bySeverity;
        if (severityResolution['Critical'] && severityResolution['Critical'].average > 24) {
            this.insights.push({
                type: 'performance',
                severity: 'critical',
                message: `Critical incidents take ${severityResolution['Critical'].average} hours to resolve on average`,
                recommendation: 'Implement faster escalation procedures for critical issues'
            });
        }

        return this.insights;
    }

    // Generate comprehensive report
    async generateReport() {
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalIncidents: this.incidents.length,
                sources: ['ShitHappens', 'Hotfixes'],
                analysisDepth: 'Deep pattern analysis with AI insights'
            },
            patterns: this.patterns,
            insights: this.insights,
            recommendations: this.generateRecommendations()
        };

        const outputPath = path.join(__dirname, '..', 'analysis', `incident-patterns-${Date.now()}.json`);
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
        
        console.log(`\n✅ Incident pattern analysis saved to: ${outputPath}`);
        return report;
    }

    // Generate actionable recommendations
    generateRecommendations() {
        return [
            {
                priority: 'HIGH',
                area: 'Component Architecture',
                action: 'Review and refactor components with high incident rates',
                impact: 'Reduce incident rate by up to 40%'
            },
            {
                priority: 'MEDIUM',
                area: 'Deployment Strategy',
                action: 'Avoid deployments during peak incident hours',
                impact: 'Minimize deployment-related incidents'
            },
            {
                priority: 'HIGH',
                area: 'Incident Response',
                action: 'Implement automated incident detection for critical components',
                impact: 'Reduce mean time to detection (MTTD)'
            },
            {
                priority: 'MEDIUM',
                area: 'Knowledge Management',
                action: 'Create runbooks for frequently occurring incident patterns',
                impact: 'Faster resolution times'
            }
        ];
    }

    // Print summary to console
    printSummary() {
        console.log('\n📊 Incident Pattern Analysis Summary');
        console.log('=' .repeat(50));
        
        console.log('\n🎯 Key Insights:');
        this.insights.forEach((insight, i) => {
            console.log(`${i + 1}. [${insight.severity.toUpperCase()}] ${insight.message}`);
            console.log(`   → ${insight.recommendation}`);
        });

        console.log('\n🔥 Top Problematic Components:');
        Object.entries(this.patterns.components.incidentsByComponent)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .forEach(([component, data]) => {
                console.log(`   - ${component}: ${data.count} incidents`);
            });
    }
}

// Main execution
async function main() {
    const analyzer = new IncidentPatternAnalyzer();
    
    await analyzer.fetchIncidentData();
    analyzer.analyzeTemporalPatterns();
    analyzer.analyzeComponentPatterns();
    analyzer.detectAnomalies();
    analyzer.generatePredictiveInsights();
    await analyzer.generateReport();
    analyzer.printSummary();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { IncidentPatternAnalyzer };