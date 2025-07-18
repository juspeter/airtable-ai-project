//======================================================================================================================
// Component Team Performance Report Script
// Purpose: Analyzes specific component teams' performance across releases
//======================================================================================================================

const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * Component Team Report Generator
 * Analyzes how specific component teams perform across releases
 */
class ComponentTeamReportGenerator {
    constructor() {
        this.componentFields = {
            hotfixes: 'Component/s',
            incidents: 'Component/s',
            integrations: 'Integration Area'
        };
    }

    /**
     * Generate component team performance report
     */
    async generateComponentReport(componentName, options = {}) {
        try {
            console.log(`Generating Component Team report for: ${componentName}`);
            
            const {
                startDate = null,
                endDate = null,
                releases = [],
                includeSubComponents = true
            } = options;

            // Collect component data
            const componentData = await this.collectComponentData(componentName, {
                startDate,
                endDate,
                releases,
                includeSubComponents
            });
            
            // Analyze performance
            const analysis = this.analyzeComponentPerformance(componentData, componentName);
            
            // Generate insights and recommendations
            const insights = this.generateComponentInsights(analysis);
            const recommendations = this.generateComponentRecommendations(analysis);
            
            // Generate report
            const report = this.generateComponentMarkdown({
                ...analysis,
                insights,
                recommendations,
                componentName,
                options
            });
            
            return {
                success: true,
                component: componentName,
                data: componentData,
                analysis: analysis,
                insights: insights,
                recommendations: recommendations,
                markdown: report,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error generating Component report for ${componentName}:`, error);
            return {
                success: false,
                error: error.message,
                component: componentName,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Collect all data related to a specific component
     */
    async collectComponentData(componentName, options) {
        const data = {
            component: componentName,
            hotfixes: [],
            incidents: [],
            integrations: [],
            builds: [],
            metrics: {
                byRelease: {},
                overall: {}
            },
            timeline: {},
            related: {
                subComponents: [],
                relatedTeams: []
            }
        };

        // Get all hotfixes for this component
        data.hotfixes = await this.getComponentHotfixes(componentName, options);
        
        // Get all incidents for this component
        data.incidents = await this.getComponentIncidents(componentName, options);
        
        // Get all integrations for this component
        data.integrations = await this.getComponentIntegrations(componentName, options);
        
        // Get affected builds
        data.builds = await this.getAffectedBuilds(data, options);
        
        // Calculate metrics by release
        data.metrics.byRelease = this.calculateMetricsByRelease(data);
        
        // Calculate overall metrics
        data.metrics.overall = this.calculateOverallMetrics(data);
        
        // Analyze timeline patterns
        data.timeline = this.analyzeComponentTimeline(data);
        
        // Find related components and teams
        if (options.includeSubComponents) {
            data.related = await this.findRelatedComponents(componentName, data);
        }
        
        return data;
    }

    /**
     * Get hotfixes associated with a component
     */
    async getComponentHotfixes(componentName, options) {
        const hotfixesTable = base.getTable('Hotfixes');
        const query = await hotfixesTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                'Priority',
                'Urgency',
                'QA State',
                'Created',
                'Resolved',
                'Component/s',
                'Build Version (Unified)',
                'Reporter'
            ]
        });

        return query.records.filter(record => {
            const components = record.getCellValue('Component/s') || [];
            const componentMatches = this.matchesComponent(components, componentName);
            
            // Apply date/release filters if specified
            if (options.startDate || options.endDate || options.releases.length > 0) {
                return componentMatches && this.matchesFilters(record, options);
            }
            
            return componentMatches;
        }).map(record => this.formatHotfixRecord(record));
    }

    /**
     * Get incidents (ShitHappens) associated with a component
     */
    async getComponentIncidents(componentName, options) {
        const incidentsTable = base.getTable('ShitHappens');
        const query = await incidentsTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                'Severity (Normalized)',
                'Created',
                'Resolved',
                'Component/s',
                'Build Version (Unified)',
                'Shithappens Root Cause',
                'Captain'
            ]
        });

        return query.records.filter(record => {
            const components = record.getCellValue('Component/s') || [];
            const componentMatches = this.matchesComponent(components, componentName);
            
            if (options.startDate || options.endDate || options.releases.length > 0) {
                return componentMatches && this.matchesFilters(record, options);
            }
            
            return componentMatches;
        }).map(record => this.formatIncidentRecord(record));
    }

    /**
     * Get integrations associated with a component
     */
    async getComponentIntegrations(componentName, options) {
        const integrationsTable = base.getTable('Integrations');
        const query = await integrationsTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                'Integration Area',
                'Integration Platform',
                'Created',
                'Resolved',
                'Build Version (Unified)',
                'Integration Requestor',
                'HL to PD Flag',
                'PD to Cert Sub Flag',
                'Live+ Flag'
            ]
        });

        return query.records.filter(record => {
            const areas = record.getCellValue('Integration Area') || [];
            const componentMatches = this.matchesComponent(areas, componentName);
            
            if (options.startDate || options.endDate || options.releases.length > 0) {
                return componentMatches && this.matchesFilters(record, options);
            }
            
            return componentMatches;
        }).map(record => this.formatIntegrationRecord(record));
    }

    /**
     * Analyze component performance
     */
    analyzeComponentPerformance(componentData, componentName) {
        return {
            component: componentName,
            summary: this.generateComponentSummary(componentData),
            reliability: this.analyzeComponentReliability(componentData),
            velocity: this.analyzeComponentVelocity(componentData),
            quality: this.analyzeComponentQuality(componentData),
            trends: this.analyzeComponentTrends(componentData),
            benchmarks: this.compareToOtherComponents(componentData),
            risk: this.assessComponentRisk(componentData)
        };
    }

    /**
     * Generate component summary statistics
     */
    generateComponentSummary(componentData) {
        const summary = {
            totalHotfixes: componentData.hotfixes.length,
            totalIncidents: componentData.incidents.length,
            totalIntegrations: componentData.integrations.length,
            affectedBuilds: componentData.builds.length,
            timeRange: this.calculateTimeRange(componentData),
            avgHotfixesPerRelease: 0,
            avgIncidentsPerRelease: 0,
            componentScore: 0
        };

        // Calculate averages
        const uniqueReleases = new Set([
            ...componentData.hotfixes.map(h => h.buildVersion),
            ...componentData.incidents.map(i => i.buildVersion),
            ...componentData.integrations.map(i => i.buildVersion)
        ]).size;

        if (uniqueReleases > 0) {
            summary.avgHotfixesPerRelease = Math.round((summary.totalHotfixes / uniqueReleases) * 10) / 10;
            summary.avgIncidentsPerRelease = Math.round((summary.totalIncidents / uniqueReleases) * 10) / 10;
        }

        // Calculate component score (0-100)
        summary.componentScore = this.calculateComponentScore(componentData);

        return summary;
    }

    /**
     * Analyze component reliability (incident patterns)
     */
    analyzeComponentReliability(componentData) {
        const incidents = componentData.incidents;
        
        return {
            incidentFrequency: this.calculateIncidentFrequency(incidents),
            severityDistribution: this.analyzeSeverityDistribution(incidents),
            mttr: this.calculateMTTR(incidents), // Mean Time To Resolution
            recurringIssues: this.identifyRecurringIssues(incidents),
            reliabilityScore: this.calculateReliabilityScore(incidents),
            rootCauses: this.analyzeRootCauses(incidents)
        };
    }

    /**
     * Analyze component velocity (development speed)
     */
    analyzeComponentVelocity(componentData) {
        return {
            integrationVelocity: this.calculateIntegrationVelocity(componentData.integrations),
            hotfixResolutionTime: this.calculateHotfixResolutionTime(componentData.hotfixes),
            releaseFrequency: this.calculateReleaseFrequency(componentData),
            velocityTrend: this.calculateVelocityTrend(componentData),
            velocityScore: this.calculateVelocityScore(componentData)
        };
    }

    /**
     * Analyze component quality metrics
     */
    analyzeComponentQuality(componentData) {
        const hotfixes = componentData.hotfixes;
        
        return {
            qaVerificationRate: this.calculateQAVerificationRate(hotfixes),
            defectDensity: this.calculateDefectDensity(componentData),
            priorityDistribution: this.analyzePriorityDistribution(hotfixes),
            qualityTrend: this.calculateQualityTrend(componentData),
            qualityScore: this.calculateQualityScore(componentData),
            testCoverage: this.estimateTestCoverage(componentData)
        };
    }

    /**
     * Calculate component score (0-100)
     */
    calculateComponentScore(componentData) {
        const weights = {
            reliability: 0.35,  // 35% - incident impact
            quality: 0.30,     // 30% - hotfix/defect patterns
            velocity: 0.20,    // 20% - development speed
            collaboration: 0.15 // 15% - integration success
        };

        const reliabilityScore = this.calculateReliabilityScore(componentData.incidents);
        const qualityScore = this.calculateQualityScore(componentData);
        const velocityScore = this.calculateVelocityScore(componentData);
        const collaborationScore = this.calculateCollaborationScore(componentData);

        const weightedScore = (
            reliabilityScore * weights.reliability +
            qualityScore * weights.quality +
            velocityScore * weights.velocity +
            collaborationScore * weights.collaboration
        );

        return Math.round(weightedScore);
    }

    /**
     * Generate component-specific insights
     */
    generateComponentInsights(analysis) {
        const insights = [];
        const component = analysis.component;
        const summary = analysis.summary;

        // Score-based insights
        if (summary.componentScore >= 85) {
            insights.push({
                type: 'positive',
                category: 'Performance',
                message: `${component} is performing excellently with a score of ${summary.componentScore}/100`,
                impact: 'high',
                evidence: `Low incident rate and high quality metrics`
            });
        } else if (summary.componentScore < 60) {
            insights.push({
                type: 'warning',
                category: 'Performance',
                message: `${component} performance below target (${summary.componentScore}/100)`,
                impact: 'high',
                evidence: `High incident rate or quality issues detected`
            });
        }

        // Reliability insights
        if (analysis.reliability.reliabilityScore < 70) {
            insights.push({
                type: 'warning',
                category: 'Reliability',
                message: `${component} reliability concerns identified`,
                impact: 'high',
                evidence: `Reliability score: ${analysis.reliability.reliabilityScore}/100`
            });
        }

        // Quality insights
        if (analysis.quality.qaVerificationRate < 80) {
            insights.push({
                type: 'warning',
                category: 'Quality',
                message: `${component} QA verification rate below target`,
                impact: 'medium',
                evidence: `${analysis.quality.qaVerificationRate}% QA verification rate`
            });
        }

        // Trend insights
        if (analysis.trends.overallTrend === 'improving') {
            insights.push({
                type: 'positive',
                category: 'Trends',
                message: `${component} showing positive improvement trends`,
                impact: 'medium',
                evidence: 'Consistent improvement across metrics'
            });
        }

        return insights;
    }

    /**
     * Generate component-specific recommendations
     */
    generateComponentRecommendations(analysis) {
        const recommendations = [];
        const component = analysis.component;

        // Reliability recommendations
        if (analysis.reliability.reliabilityScore < 70) {
            recommendations.push({
                priority: 'high',
                category: 'Reliability Improvement',
                component: component,
                recommendation: `Implement proactive monitoring and testing for ${component}`,
                evidence: `Reliability score: ${analysis.reliability.reliabilityScore}/100`,
                expectedImpact: 'Reduce incidents by 25-30%',
                actionItems: [
                    'Add comprehensive automated testing',
                    'Implement monitoring dashboards',
                    'Review and update documentation'
                ]
            });
        }

        // Quality recommendations
        if (analysis.quality.qaVerificationRate < 85) {
            recommendations.push({
                priority: 'medium',
                category: 'Quality Assurance',
                component: component,
                recommendation: `Strengthen QA processes for ${component} changes`,
                evidence: `QA verification rate: ${analysis.quality.qaVerificationRate}%`,
                expectedImpact: 'Improve quality score by 15-20 points',
                actionItems: [
                    'Mandatory QA review for all hotfixes',
                    'Enhanced testing protocols',
                    'Quality gate implementation'
                ]
            });
        }

        // Velocity recommendations
        if (analysis.velocity.velocityScore < 70) {
            recommendations.push({
                priority: 'medium',
                category: 'Development Velocity',
                component: component,
                recommendation: `Optimize development processes for ${component}`,
                evidence: `Velocity score: ${analysis.velocity.velocityScore}/100`,
                expectedImpact: 'Reduce development time by 20%',
                actionItems: [
                    'Streamline integration processes',
                    'Implement CI/CD improvements',
                    'Reduce manual handoffs'
                ]
            });
        }

        return recommendations;
    }

    /**
     * Generate markdown report
     */
    generateComponentMarkdown(reportData) {
        const { componentName, analysis, insights, recommendations } = reportData;
        const summary = analysis.summary;
        
        return `# 🏗️ Component Team Report: ${componentName}

## 📊 Component Overview

**Component Score**: ${summary.componentScore}/100 ${this.getScoreEmoji(summary.componentScore)}
**Analysis Period**: ${summary.timeRange.start} to ${summary.timeRange.end}
**Affected Builds**: ${summary.affectedBuilds}

### Key Metrics
- **Total Hotfixes**: ${summary.totalHotfixes}
- **Total Incidents**: ${summary.totalIncidents}  
- **Total Integrations**: ${summary.totalIntegrations}
- **Avg Hotfixes/Release**: ${summary.avgHotfixesPerRelease}
- **Avg Incidents/Release**: ${summary.avgIncidentsPerRelease}

---

## 🎯 Performance Analysis

### Reliability Score: ${analysis.reliability.reliabilityScore}/100 ${this.getScoreEmoji(analysis.reliability.reliabilityScore)}
- **MTTR**: ${analysis.reliability.mttr} hours
- **Incident Frequency**: ${analysis.reliability.incidentFrequency}
- **Severity Distribution**: ${this.formatSeverityDistribution(analysis.reliability.severityDistribution)}

### Quality Score: ${analysis.quality.qualityScore}/100 ${this.getScoreEmoji(analysis.quality.qualityScore)}
- **QA Verification Rate**: ${analysis.quality.qaVerificationRate}%
- **Defect Density**: ${analysis.quality.defectDensity} defects per release
- **Priority Distribution**: ${this.formatPriorityDistribution(analysis.quality.priorityDistribution)}

### Velocity Score: ${analysis.velocity.velocityScore}/100 ${this.getScoreEmoji(analysis.velocity.velocityScore)}
- **Integration Velocity**: ${analysis.velocity.integrationVelocity} days avg
- **Hotfix Resolution Time**: ${analysis.velocity.hotfixResolutionTime} hours avg
- **Release Frequency**: ${analysis.velocity.releaseFrequency}

---

## 📈 Trends & Benchmarks

### Component Trends
- **Overall Trend**: ${analysis.trends.overallTrend} ${this.getTrendEmoji(analysis.trends.overallTrend)}
- **Reliability Trend**: ${analysis.trends.reliabilityTrend} ${this.getTrendEmoji(analysis.trends.reliabilityTrend)}
- **Quality Trend**: ${analysis.trends.qualityTrend} ${this.getTrendEmoji(analysis.trends.qualityTrend)}

### Benchmarks vs Other Components
- **Ranking**: ${analysis.benchmarks.ranking} out of ${analysis.benchmarks.totalComponents}
- **Percentile**: ${analysis.benchmarks.percentile}th percentile
- **Best Practice Areas**: ${analysis.benchmarks.strengths.join(', ')}
- **Improvement Areas**: ${analysis.benchmarks.weaknesses.join(', ')}

---

## 🚨 Risk Assessment

**Risk Level**: ${analysis.risk.level} ${this.getRiskEmoji(analysis.risk.level)}

### Risk Factors
${analysis.risk.factors.map(factor => `- **${factor.category}**: ${factor.description} (${factor.severity})`).join('\n')}

---

## 💡 Key Insights

${insights.map(insight => 
    `### ${insight.type === 'positive' ? '🟢' : '🟡'} ${insight.category}\n` +
    `${insight.message}\n` +
    `*Evidence: ${insight.evidence}*`
).join('\n\n')}

---

## 🎯 Recommendations

${recommendations.map((rec, index) => 
    `### ${index + 1}. ${rec.category} (${rec.priority.toUpperCase()} Priority)\n` +
    `**Recommendation**: ${rec.recommendation}\n` +
    `**Evidence**: ${rec.evidence}\n` +
    `**Expected Impact**: ${rec.expectedImpact}\n` +
    `**Action Items**:\n${rec.actionItems.map(item => `- ${item}`).join('\n')}\n`
).join('\n')}

---

## 📋 Detailed Breakdown

### Recent Hotfixes (Last 10)
${this.formatRecentHotfixes(reportData.data.hotfixes.slice(-10))}

### Recent Incidents (Last 5)
${this.formatRecentIncidents(reportData.data.incidents.slice(-5))}

---

*${componentName} Component Report generated on ${new Date().toLocaleString()}*
*Analysis covers ${summary.totalHotfixes + summary.totalIncidents + summary.totalIntegrations} total items across ${summary.affectedBuilds} builds*`;
    }

    // Helper methods
    matchesComponent(components, targetComponent) {
        if (!Array.isArray(components)) return false;
        return components.some(comp => 
            comp && comp.toLowerCase().includes(targetComponent.toLowerCase())
        );
    }

    getScoreEmoji(score) {
        if (score >= 85) return '🟢';
        if (score >= 70) return '🟡';
        if (score >= 50) return '🟠';
        return '🔴';
    }

    getTrendEmoji(trend) {
        return trend === 'improving' ? '⬆️' : trend === 'declining' ? '⬇️' : '➡️';
    }

    getRiskEmoji(level) {
        switch(level) {
            case 'low': return '🟢';
            case 'medium': return '🟡';
            case 'high': return '🔴';
            default: return '❓';
        }
    }

    // Additional helper methods would be implemented here...
    formatHotfixRecord(record) { /* ... */ }
    formatIncidentRecord(record) { /* ... */ }
    formatIntegrationRecord(record) { /* ... */ }
    calculateReliabilityScore(incidents) { /* ... */ }
    calculateQualityScore(componentData) { /* ... */ }
    calculateVelocityScore(componentData) { /* ... */ }
    calculateCollaborationScore(componentData) { /* ... */ }
}

module.exports = ComponentTeamReportGenerator;

// Usage example
if (require.main === module) {
    const generator = new ComponentTeamReportGenerator();
    
    // Generate report for BR - Quests component
    generator.generateComponentReport('BR - Quests', {
        startDate: '2025-01-01',
        endDate: '2025-07-18',
        includeSubComponents: true
    })
    .then(result => {
        if (result.success) {
            console.log(result.markdown);
        } else {
            console.error('Report generation failed:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}