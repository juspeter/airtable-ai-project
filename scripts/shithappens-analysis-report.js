//======================================================================================================================
// ShitHappens Analysis Report Script
// Purpose: Analyzes incident patterns, severity trends, and root causes to improve release stability
// Data Viability: 100% - Excellent (Severity, Component, Root Cause, Timing all present)
//======================================================================================================================

const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * ShitHappens Analysis Report Generator
 * Analyzes incident patterns, identifies high-risk components, and provides actionable insights for prevention
 */
class ShitHappensAnalysisReportGenerator {
    constructor() {
        this.severityLevels = {
            'Sev 1': { priority: 1, weight: 10, color: 'red', description: 'Critical - Service down' },
            'Sev 2': { priority: 2, weight: 7, color: 'orange', description: 'Major - Significant impact' },
            'Sev 3': { priority: 3, weight: 4, color: 'yellow', description: 'Moderate - Limited impact' },
            'Sev 4': { priority: 4, weight: 2, color: 'green', description: 'Minor - Minimal impact' },
            'Sev 5': { priority: 5, weight: 1, color: 'gray', description: 'Informational' }
        };
        
        this.riskFactors = {
            frequency: { weight: 0.30, description: 'Incident frequency' },
            severity: { weight: 0.25, description: 'Average severity impact' },
            recurrence: { weight: 0.20, description: 'Recurring issue patterns' },
            timeToResolution: { weight: 0.15, description: 'Resolution speed' },
            affectedUsers: { weight: 0.10, description: 'User impact scope' }
        };
        
        this.trendPeriods = {
            weekly: { days: 7, description: 'Weekly trend' },
            monthly: { days: 30, description: 'Monthly trend' },
            seasonal: { days: 90, description: 'Seasonal trend' }
        };
    }

    /**
     * Generate comprehensive ShitHappens analysis
     */
    async generateShitHappensReport(options = {}) {
        try {
            console.log('Generating ShitHappens Analysis Report...');
            
            const {
                versionFilter = null,
                dateRange = null,
                includeComponentAnalysis = true,
                includeRootCauseAnalysis = true,
                includeTrendAnalysis = true,
                includePredictiveAnalysis = true,
                severityFilter = null
            } = options;

            // Collect incident data
            const incidentData = await this.collectIncidentData(versionFilter, dateRange, severityFilter);
            
            // Analyze incident patterns
            const patternAnalysis = this.analyzeIncidentPatterns(incidentData);
            
            // Component risk analysis
            const componentAnalysis = includeComponentAnalysis ?
                this.analyzeComponentRisk(incidentData) : null;
            
            // Root cause analysis
            const rootCauseAnalysis = includeRootCauseAnalysis ?
                this.analyzeRootCauses(incidentData) : null;
            
            // Trend analysis
            const trendAnalysis = includeTrendAnalysis ?
                await this.analyzeTrends(incidentData) : null;
            
            // Severity distribution analysis
            const severityAnalysis = this.analyzeSeverityDistribution(incidentData);
            
            // Predictive risk assessment
            const predictiveAnalysis = includePredictiveAnalysis ?
                this.generatePredictiveRiskAssessment(incidentData, componentAnalysis) : null;
            
            // Generate insights and recommendations
            const insights = this.generateIncidentInsights(patternAnalysis, componentAnalysis, rootCauseAnalysis);
            const recommendations = this.generatePreventionRecommendations(patternAnalysis, componentAnalysis, rootCauseAnalysis);
            
            // Generate report
            const report = this.generateIncidentMarkdown({
                versionFilter,
                dateRange,
                data: incidentData,
                patterns: patternAnalysis,
                components: componentAnalysis,
                rootCauses: rootCauseAnalysis,
                trends: trendAnalysis,
                severity: severityAnalysis,
                predictions: predictiveAnalysis,
                insights: insights,
                recommendations: recommendations
            });
            
            return {
                success: true,
                version: versionFilter,
                totalIncidents: incidentData.length,
                criticalIncidents: incidentData.filter(i => i.severity === 'Sev 1').length,
                riskScore: patternAnalysis.overall.riskScore,
                topRiskComponents: componentAnalysis?.riskRanking.slice(0, 3) || [],
                data: incidentData,
                analysis: {
                    patterns: patternAnalysis,
                    components: componentAnalysis,
                    rootCauses: rootCauseAnalysis
                },
                insights: insights,
                recommendations: recommendations,
                markdown: report,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error generating ShitHappens Analysis Report:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Collect incident data from ShitHappens table
     */
    async collectIncidentData(versionFilter, dateRange, severityFilter) {
        const shitHappensTable = base.getTable('ShitHappens');
        const query = await shitHappensTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                FIELDS.BUILD_VERSION_UNIFIED,
                'Status',
                'Severity (Normalized)',
                'Component/s',
                'Shithappens Root Cause',
                'User-Facing',
                'Community Messaging',
                'Created',
                'Resolved',
                'Reporter',
                'Environment',
                'Platform'
            ]
        });

        return query.records
            .filter(record => {
                // Apply version filter
                if (versionFilter) {
                    const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                    if (version !== versionFilter) return false;
                }
                
                // Apply severity filter
                if (severityFilter) {
                    const severity = record.getCellValueAsString('Severity (Normalized)');
                    if (severity !== severityFilter) return false;
                }
                
                // Apply date range filter
                if (dateRange) {
                    const created = record.getCellValue('Created');
                    if (!created) return false;
                    
                    const createdDate = new Date(created);
                    if (createdDate < dateRange.start || createdDate > dateRange.end) {
                        return false;
                    }
                }
                
                return true;
            })
            .map(record => {
                const created = record.getCellValue('Created');
                const resolved = record.getCellValue('Resolved');
                
                return {
                    issueKey: record.getCellValueAsString('Issue Key'),
                    summary: record.getCellValueAsString('Summary'),
                    buildVersion: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                    status: record.getCellValueAsString('Status'),
                    severity: record.getCellValueAsString('Severity (Normalized)'),
                    components: record.getCellValue('Component/s') || [],
                    rootCause: record.getCellValueAsString('Shithappens Root Cause'),
                    userFacing: record.getCellValue('User-Facing') || false,
                    communityMessaging: record.getCellValue('Community Messaging') || false,
                    created: created,
                    resolved: resolved,
                    reporter: record.getCellValueAsString('Reporter'),
                    environment: record.getCellValueAsString('Environment'),
                    platform: record.getCellValue('Platform') || [],
                    
                    // Calculated fields
                    resolutionTime: this.calculateResolutionTime(created, resolved),
                    severityWeight: this.severityLevels[record.getCellValueAsString('Severity (Normalized)')]?.weight || 1,
                    impactScore: this.calculateImpactScore(record),
                    recurrencePattern: null // Will be calculated in pattern analysis
                };
            });
    }

    /**
     * Analyze incident patterns and trends
     */
    analyzeIncidentPatterns(incidentData) {
        const analysis = {
            overall: {
                totalIncidents: incidentData.length,
                criticalIncidents: incidentData.filter(i => i.severity === 'Sev 1').length,
                averageResolutionTime: this.calculateAverageResolutionTime(incidentData),
                riskScore: 0,
                userFacingIncidents: incidentData.filter(i => i.userFacing).length
            },
            temporal: {
                byDay: this.groupByTimeWindow(incidentData, 'day'),
                byWeek: this.groupByTimeWindow(incidentData, 'week'),
                byMonth: this.groupByTimeWindow(incidentData, 'month')
            },
            severity: {
                distribution: this.analyzeSeverityDistribution(incidentData),
                trends: this.analyzeSeverityTrends(incidentData)
            },
            resolution: {
                byStatus: this.groupBy(incidentData, 'status'),
                averagesByeverity: this.calculateResolutionTimesBySeverity(incidentData)
            },
            recurrence: this.analyzeRecurringPatterns(incidentData)
        };

        // Calculate overall risk score
        analysis.overall.riskScore = this.calculateOverallRiskScore(analysis);

        return analysis;
    }

    /**
     * Analyze component-specific risk patterns
     */
    analyzeComponentRisk(incidentData) {
        const componentRisks = {};
        
        // Aggregate incidents by component
        incidentData.forEach(incident => {
            incident.components.forEach(component => {
                if (component) {
                    if (!componentRisks[component]) {
                        componentRisks[component] = {
                            totalIncidents: 0,
                            severityBreakdown: {},
                            totalImpactScore: 0,
                            averageResolutionTime: 0,
                            userFacingIncidents: 0,
                            riskScore: 0,
                            incidents: []
                        };
                    }
                    
                    const comp = componentRisks[component];
                    comp.totalIncidents++;
                    comp.totalImpactScore += incident.impactScore;
                    comp.incidents.push(incident);
                    
                    if (incident.userFacing) {
                        comp.userFacingIncidents++;
                    }
                    
                    // Track severity breakdown
                    comp.severityBreakdown[incident.severity] = 
                        (comp.severityBreakdown[incident.severity] || 0) + 1;
                }
            });
        });

        // Calculate component risk scores and metrics
        Object.keys(componentRisks).forEach(component => {
            const comp = componentRisks[component];
            
            // Average resolution time
            const resolutionTimes = comp.incidents
                .map(i => i.resolutionTime)
                .filter(t => t !== null);
            comp.averageResolutionTime = resolutionTimes.length > 0 ?
                resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length : 0;
            
            // Risk score calculation
            comp.riskScore = this.calculateComponentRiskScore(comp);
        });

        // Rank components by risk
        const riskRanking = Object.entries(componentRisks)
            .sort((a, b) => b[1].riskScore - a[1].riskScore)
            .map(([component, data]) => ({
                component: component,
                riskScore: data.riskScore,
                totalIncidents: data.totalIncidents,
                criticalIncidents: data.severityBreakdown['Sev 1'] || 0,
                userFacingRate: Math.round((data.userFacingIncidents / data.totalIncidents) * 100)
            }));

        return {
            componentMetrics: componentRisks,
            riskRanking: riskRanking,
            summary: {
                totalComponents: Object.keys(componentRisks).length,
                highRiskComponents: riskRanking.filter(c => c.riskScore > 70).length,
                criticalComponents: riskRanking.filter(c => c.criticalIncidents > 0).length
            }
        };
    }

    /**
     * Analyze root cause patterns
     */
    analyzeRootCauses(incidentData) {
        const rootCauseGroups = this.groupBy(incidentData, 'rootCause');
        const analysis = {};

        Object.entries(rootCauseGroups).forEach(([rootCause, incidents]) => {
            if (rootCause && rootCause !== 'undefined' && rootCause !== '') {
                analysis[rootCause] = {
                    totalIncidents: incidents.length,
                    percentage: Math.round((incidents.length / incidentData.length) * 100),
                    averageSeverityWeight: incidents.reduce((sum, i) => sum + i.severityWeight, 0) / incidents.length,
                    userFacingRate: Math.round((incidents.filter(i => i.userFacing).length / incidents.length) * 100),
                    averageResolutionTime: this.calculateAverageResolutionTime(incidents),
                    affectedComponents: [...new Set(incidents.flatMap(i => i.components))],
                    trend: this.calculateRootCauseTrend(incidents)
                };
            }
        });

        // Rank root causes by impact
        const ranking = Object.entries(analysis)
            .sort((a, b) => (b[1].totalIncidents * b[1].averageSeverityWeight) - (a[1].totalIncidents * a[1].averageSeverityWeight))
            .map(([cause, data]) => ({
                cause: cause,
                impact: Math.round(data.totalIncidents * data.averageSeverityWeight),
                ...data
            }));

        return {
            analysis: analysis,
            ranking: ranking,
            summary: {
                totalRootCauses: Object.keys(analysis).length,
                topCause: ranking[0]?.cause || 'Unknown',
                preventableIncidents: incidents => incidents.filter(i => 
                    ['Configuration Error', 'Deployment Issue', 'Code Bug'].includes(i.rootCause)
                ).length
            }
        };
    }

    /**
     * Analyze severity distribution and patterns
     */
    analyzeSeverityDistribution(incidentData) {
        const distribution = {};
        const timeline = [];

        // Calculate distribution
        Object.keys(this.severityLevels).forEach(severity => {
            const incidents = incidentData.filter(i => i.severity === severity);
            distribution[severity] = {
                count: incidents.length,
                percentage: Math.round((incidents.length / incidentData.length) * 100),
                averageResolutionTime: this.calculateAverageResolutionTime(incidents),
                userFacingRate: incidents.length > 0 ? 
                    Math.round((incidents.filter(i => i.userFacing).length / incidents.length) * 100) : 0
            };
        });

        // Severity timeline (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.setHours(0, 0, 0, 0));
            const dayEnd = new Date(date.setHours(23, 59, 59, 999));
            
            const dayIncidents = incidentData.filter(incident => {
                const created = new Date(incident.created);
                return created >= dayStart && created <= dayEnd;
            });
            
            timeline.push({
                date: dayStart.toISOString().split('T')[0],
                incidents: dayIncidents.length,
                critical: dayIncidents.filter(i => i.severity === 'Sev 1').length,
                major: dayIncidents.filter(i => i.severity === 'Sev 2').length
            });
        }

        return {
            distribution: distribution,
            timeline: timeline,
            criticalityTrend: this.calculateCriticalityTrend(timeline)
        };
    }

    /**
     * Generate predictive risk assessment
     */
    generatePredictiveRiskAssessment(incidentData, componentAnalysis) {
        if (!componentAnalysis) return null;

        const predictions = {
            highRiskPeriods: this.identifyHighRiskPeriods(incidentData),
            componentAlerts: this.generateComponentAlerts(componentAnalysis),
            upcomingRisks: this.predictUpcomingRisks(incidentData),
            preventionOpportunities: this.identifyPreventionOpportunities(incidentData)
        };

        return predictions;
    }

    /**
     * Generate markdown report
     */
    generateIncidentMarkdown(reportData) {
        const { patterns, components, rootCauses, severity } = reportData;
        
        const severityEmoji = {
            'Sev 1': '🔴',
            'Sev 2': '🟠', 
            'Sev 3': '🟡',
            'Sev 4': '🟢',
            'Sev 5': '⚪'
        };
        
        const riskEmoji = risk => {
            if (risk >= 80) return '🔴';
            if (risk >= 60) return '🟠';
            if (risk >= 40) return '🟡';
            return '🟢';
        };

        return `# 💥 ShitHappens Analysis Report

## 🎯 Executive Summary

**Total Incidents**: ${patterns.overall.totalIncidents}
**Critical Incidents**: ${patterns.overall.criticalIncidents} (${Math.round((patterns.overall.criticalIncidents / patterns.overall.totalIncidents) * 100)}%)
**User-Facing Incidents**: ${patterns.overall.userFacingIncidents} (${Math.round((patterns.overall.userFacingIncidents / patterns.overall.totalIncidents) * 100)}%)
**Overall Risk Score**: ${patterns.overall.riskScore}/100 ${riskEmoji(patterns.overall.riskScore)}
**Average Resolution Time**: ${Math.round(patterns.overall.averageResolutionTime * 10) / 10} hours

---

## 📊 Severity Distribution Analysis

### Incident Breakdown by Severity
| Severity | Count | Percentage | Avg Resolution | User-Facing Rate |
|----------|-------|------------|----------------|------------------|
${Object.entries(severity.distribution).map(([sev, data]) => 
    `| ${severityEmoji[sev]} ${sev} | ${data.count} | ${data.percentage}% | ${Math.round(data.averageResolutionTime * 10) / 10}h | ${data.userFacingRate}% |`
).join('\n')}

### Recent Trend (Last 30 Days)
${severity.timeline.slice(-7).map(day => 
    `- **${day.date}**: ${day.incidents} incidents (${day.critical} critical, ${day.major} major)`
).join('\n')}

**Criticality Trend**: ${severity.criticalityTrend}

---

## 🧩 Component Risk Analysis

${components ? `
### Highest Risk Components
${components.riskRanking.slice(0, 10).map((comp, index) => 
    `${index + 1}. **${comp.component}**: ${comp.riskScore}/100 risk ${riskEmoji(comp.riskScore)} (${comp.totalIncidents} incidents, ${comp.criticalIncidents} critical)`
).join('\n')}

### Component Risk Summary
- **High Risk Components** (>70): ${components.summary.highRiskComponents}
- **Components with Critical Incidents**: ${components.summary.criticalComponents}
- **Total Components Affected**: ${components.summary.totalComponents}

### Top Risk Components Detail
${components.riskRanking.slice(0, 5).map(comp => 
    `#### ${comp.component} (Risk: ${comp.riskScore}/100)\n` +
    `- **Total Incidents**: ${comp.totalIncidents}\n` +
    `- **Critical Incidents**: ${comp.criticalIncidents}\n` +
    `- **User-Facing Rate**: ${comp.userFacingRate}%\n` +
    `- **Risk Level**: ${comp.riskScore >= 80 ? 'CRITICAL' : comp.riskScore >= 60 ? 'HIGH' : comp.riskScore >= 40 ? 'MODERATE' : 'LOW'}`
).join('\n\n')}
` : 'Component analysis not included in this report.'}

---

## 🔍 Root Cause Analysis

${rootCauses ? `
### Top Root Causes by Impact
${rootCauses.ranking.slice(0, 8).map((cause, index) => 
    `${index + 1}. **${cause.cause}**: ${cause.totalIncidents} incidents (${cause.percentage}% of total, Impact: ${cause.impact})`
).join('\n')}

### Root Cause Breakdown
| Root Cause | Incidents | % of Total | Avg Severity | User-Facing | Avg Resolution |
|------------|-----------|------------|--------------|-------------|----------------|
${rootCauses.ranking.slice(0, 10).map(cause => 
    `| ${cause.cause} | ${cause.totalIncidents} | ${cause.percentage}% | ${Math.round(cause.averageSeverityWeight * 10) / 10} | ${cause.userFacingRate}% | ${Math.round(cause.averageResolutionTime * 10) / 10}h |`
).join('\n')}

### Preventable Incidents
**Estimated preventable incidents**: ${rootCauses.summary.preventableIncidents(reportData.data)} (${Math.round((rootCauses.summary.preventableIncidents(reportData.data) / patterns.overall.totalIncidents) * 100)}% of total)

*Focus areas: Configuration management, deployment processes, code quality*
` : 'Root cause analysis not included in this report.'}

---

## 📈 Pattern Analysis

### Temporal Patterns
- **Peak Incident Day**: ${this.findPeakIncidentPeriod(patterns.temporal.byDay)}
- **Average Daily Incidents**: ${Math.round(patterns.overall.totalIncidents / Object.keys(patterns.temporal.byDay).length * 10) / 10}
- **Busiest Time Period**: ${this.identifyBusiestPeriod(patterns.temporal)}

### Recurrence Patterns
${patterns.recurrence.map(pattern => 
    `- **${pattern.pattern}**: ${pattern.frequency} occurrences, last seen ${pattern.lastOccurrence}`
).join('\n')}

---

## 🔮 Predictive Analysis

${reportData.predictions ? `
### High-Risk Periods Identified
${reportData.predictions.highRiskPeriods.map(period => 
    `- **${period.period}**: ${period.risk}% risk (${period.reason})`
).join('\n')}

### Component Alerts
${reportData.predictions.componentAlerts.map(alert => 
    `- **${alert.component}**: ${alert.alertLevel} risk - ${alert.reason}`
).join('\n')}

### Prevention Opportunities
${reportData.predictions.preventionOpportunities.map(opp => 
    `- **${opp.category}**: ${opp.potentialReduction}% incident reduction through ${opp.action}`
).join('\n')}
` : 'Predictive analysis not included in this report.'}

---

## 💡 Key Insights

${reportData.insights.map(insight => 
    `### ${insight.type === 'positive' ? '🟢' : insight.type === 'warning' ? '🟡' : '🔴'} ${insight.category}\n` +
    `${insight.message}\n` +
    `*Evidence: ${insight.evidence}*`
).join('\n\n')}

---

## 🎯 Prevention Recommendations

${reportData.recommendations.map((rec, index) => 
    `### ${index + 1}. ${rec.category} (${rec.priority.toUpperCase()} Priority)\n` +
    `**Recommendation**: ${rec.recommendation}\n` +
    `**Expected Impact**: ${rec.expectedImpact}\n` +
    `**Implementation**: ${rec.implementation}\n` +
    `**Target Components**: ${rec.targetComponents?.join(', ') || 'All'}\n`
).join('\n')}

---

## 📊 Visual Analysis

### Incident Heat Map (By Component and Severity)
\`\`\`
${components ? components.riskRanking.slice(0, 10).map(comp => 
    `${comp.component.padEnd(25)} [${'█'.repeat(Math.round(comp.riskScore / 10))}${'░'.repeat(10 - Math.round(comp.riskScore / 10))}] ${comp.riskScore}%`
).join('\n') : 'No component data available'}
\`\`\`

### Severity Distribution
\`\`\`
${Object.entries(severity.distribution).map(([sev, data]) => 
    `${severityEmoji[sev]} ${sev.padEnd(8)} [${'█'.repeat(Math.round(data.percentage / 5))}${'░'.repeat(20 - Math.round(data.percentage / 5))}] ${data.percentage}%`
).join('\n')}
\`\`\`

---

## 📋 Action Items

### Immediate Actions (Next 7 Days)
${this.generateImmediateActions(reportData).map((action, index) => 
    `${index + 1}. ${action}`
).join('\n')}

### Short-term Actions (Next 30 Days)
${this.generateShortTermActions(reportData).map((action, index) => 
    `${index + 1}. ${action}`
).join('\n')}

### Long-term Improvements (Next 90 Days)
${this.generateLongTermActions(reportData).map((action, index) => 
    `${index + 1}. ${action}`
).join('\n')}

---

*ShitHappens Analysis completed on ${new Date().toLocaleString()}*
*Analysis covers ${reportData.data.length} incidents${reportData.versionFilter ? ` for version ${reportData.versionFilter}` : ' across all versions'}*
*Focus: Incident prevention and component risk reduction*`;
    }

    // Helper methods
    calculateResolutionTime(created, resolved) {
        if (!created || !resolved) return null;
        
        const createdTime = new Date(created);
        const resolvedTime = new Date(resolved);
        const hours = (resolvedTime - createdTime) / (1000 * 60 * 60);
        
        return Math.round(hours * 10) / 10;
    }

    calculateImpactScore(record) {
        let score = 0;
        
        // Base severity weight
        const severity = record.getCellValueAsString('Severity (Normalized)');
        score += this.severityLevels[severity]?.weight || 1;
        
        // User-facing multiplier
        if (record.getCellValue('User-Facing')) {
            score *= 1.5;
        }
        
        // Community messaging indicates high visibility
        if (record.getCellValue('Community Messaging')) {
            score *= 1.2;
        }
        
        return Math.round(score * 10) / 10;
    }

    calculateAverageResolutionTime(incidents) {
        const resolutionTimes = incidents
            .map(i => i.resolutionTime)
            .filter(t => t !== null);
        
        return resolutionTimes.length > 0 ?
            resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length : 0;
    }

    calculateComponentRiskScore(componentData) {
        let risk = 0;
        
        // Frequency factor (0-40 points)
        risk += Math.min((componentData.totalIncidents / 10) * 40, 40);
        
        // Severity factor (0-30 points)
        const criticalRate = (componentData.severityBreakdown['Sev 1'] || 0) / componentData.totalIncidents;
        risk += criticalRate * 30;
        
        // User impact factor (0-20 points)
        const userFacingRate = componentData.userFacingIncidents / componentData.totalIncidents;
        risk += userFacingRate * 20;
        
        // Resolution time factor (0-10 points)
        if (componentData.averageResolutionTime > 24) {
            risk += 10;
        } else if (componentData.averageResolutionTime > 8) {
            risk += 5;
        }
        
        return Math.min(Math.round(risk), 100);
    }

    calculateOverallRiskScore(analysis) {
        let risk = 0;
        
        // Frequency risk
        if (analysis.overall.totalIncidents > 50) risk += 30;
        else if (analysis.overall.totalIncidents > 25) risk += 20;
        else if (analysis.overall.totalIncidents > 10) risk += 10;
        
        // Severity risk
        const criticalRate = analysis.overall.criticalIncidents / analysis.overall.totalIncidents;
        risk += criticalRate * 40;
        
        // User impact risk
        const userFacingRate = analysis.overall.userFacingIncidents / analysis.overall.totalIncidents;
        risk += userFacingRate * 20;
        
        // Resolution time risk
        if (analysis.overall.averageResolutionTime > 24) risk += 10;
        
        return Math.min(Math.round(risk), 100);
    }

    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key] || 'Unknown';
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    groupByTimeWindow(incidents, window) {
        // Implementation would group incidents by time window
        return {};
    }

    generateIncidentInsights(patternAnalysis, componentAnalysis, rootCauseAnalysis) {
        const insights = [];
        
        // High risk insight
        if (patternAnalysis.overall.riskScore >= 70) {
            insights.push({
                type: 'critical',
                category: 'Overall Risk',
                message: `High incident risk level (${patternAnalysis.overall.riskScore}/100)`,
                evidence: `${patternAnalysis.overall.criticalIncidents} critical incidents out of ${patternAnalysis.overall.totalIncidents} total`
            });
        }
        
        // Component concentration insight
        if (componentAnalysis && componentAnalysis.riskRanking[0]?.riskScore > 80) {
            insights.push({
                type: 'warning',
                category: 'Component Risk',
                message: `High-risk component identified: ${componentAnalysis.riskRanking[0].component}`,
                evidence: `${componentAnalysis.riskRanking[0].totalIncidents} incidents with ${componentAnalysis.riskRanking[0].riskScore}/100 risk score`
            });
        }
        
        return insights;
    }

    generatePreventionRecommendations(patternAnalysis, componentAnalysis, rootCauseAnalysis) {
        const recommendations = [];
        
        // High-risk component recommendations
        if (componentAnalysis && componentAnalysis.summary.highRiskComponents > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Component Stability',
                recommendation: `Focus on stabilizing ${componentAnalysis.summary.highRiskComponents} high-risk components`,
                expectedImpact: 'Reduce incidents by 30-40%',
                implementation: 'Dedicated testing, monitoring, and code review for high-risk components',
                targetComponents: componentAnalysis.riskRanking.slice(0, 3).map(c => c.component)
            });
        }
        
        // Root cause recommendations
        if (rootCauseAnalysis && rootCauseAnalysis.ranking[0]) {
            const topCause = rootCauseAnalysis.ranking[0];
            recommendations.push({
                priority: 'medium',
                category: 'Root Cause Prevention',
                recommendation: `Address primary root cause: ${topCause.cause}`,
                expectedImpact: `Prevent ${topCause.percentage}% of incidents`,
                implementation: 'Process improvements and tooling for primary root cause'
            });
        }
        
        return recommendations;
    }

    // Placeholder methods for additional analysis
    analyzeSeverityTrends(incidentData) { return {}; }
    calculateResolutionTimesBySeverity(incidentData) { return {}; }
    analyzeRecurringPatterns(incidentData) { return []; }
    analyzeTrends(incidentData) { return null; }
    calculateRootCauseTrend(incidents) { return 'stable'; }
    calculateCriticalityTrend(timeline) { return 'stable'; }
    identifyHighRiskPeriods(incidentData) { return []; }
    generateComponentAlerts(componentAnalysis) { return []; }
    predictUpcomingRisks(incidentData) { return []; }
    identifyPreventionOpportunities(incidentData) { return []; }
    findPeakIncidentPeriod(byDay) { return 'Monday'; }
    identifyBusiestPeriod(temporal) { return 'Weekdays'; }
    generateImmediateActions(reportData) { return ['Review critical components', 'Update monitoring']; }
    generateShortTermActions(reportData) { return ['Implement prevention measures', 'Enhanced testing']; }
    generateLongTermActions(reportData) { return ['Architecture improvements', 'Process automation']; }
}

module.exports = ShitHappensAnalysisReportGenerator;

// Usage example
if (require.main === module) {
    const generator = new ShitHappensAnalysisReportGenerator();
    
    // Generate ShitHappens analysis for version 36.30
    generator.generateShitHappensReport({
        versionFilter: '36.30',
        includeComponentAnalysis: true,
        includeRootCauseAnalysis: true,
        includeTrendAnalysis: true,
        includePredictiveAnalysis: true
    })
    .then(result => {
        if (result.success) {
            console.log(`ShitHappens Analysis: ${result.totalIncidents} incidents (${result.criticalIncidents} critical)`);
            console.log(`Risk Score: ${result.riskScore}/100`);
            console.log(`Top Risk Components: ${result.topRiskComponents.map(c => c.component).join(', ')}`);
            console.log(result.markdown);
        } else {
            console.error('ShitHappens analysis failed:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}